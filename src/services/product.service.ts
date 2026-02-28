// src/services/product.service.ts
// 상품 CRUD 서비스 — 등록, 조회, 수정, 삭제, 품절 처리

import { prisma } from '@/lib/prisma';
import {
    generateStyleCode,
    generateSKUs,
    isOutletPrice,
    calcDiscountRate,
    inferColorName,
} from '@/lib/style-code';
import type { SeasonType, ProductStatus } from '@prisma/client';

// ─── 타입 정의 ───

export interface CreateProductInput {
    name: string;
    year: number;
    season: SeasonType;
    categoryCode: string;   // "JK", "PT" 등
    tagPrice: number;
    costPrice: number;
    brandId?: string;
    material?: string;
    careGuide?: string;
    measurements?: Record<string, unknown>;
    description?: string;
    variants: VariantInput[];
}

export interface VariantInput {
    colorCode: string;      // "BK", "BR"
    colorName?: string;
    sellingPrice: number;
    sizes: string[];         // ["0", "1", "2"]
}

export interface ProductListFilter {
    year?: number;
    season?: SeasonType;
    categoryId?: string;
    status?: ProductStatus;
    isOutlet?: boolean;
    search?: string;         // 제품명 또는 스타일 코드 검색
    page?: number;
    limit?: number;
}

// ─── 상품 등록 ───

export async function createProduct(input: CreateProductInput) {
    return prisma.$transaction(async (tx) => {
        // 1. 카테고리 조회
        const category = await tx.category.findUnique({
            where: { code: input.categoryCode },
        });
        if (!category) {
            throw new Error(`[상품 등록 오류] 존재하지 않는 카테고리 코드: ${input.categoryCode}`);
        }

        // 2. 스타일 코드 자동 생성
        const styleCode = await generateStyleCode(input.year, input.season, input.categoryCode);

        // 3. 아울렛 판별 (가장 낮은 판매가 기준)
        const minSelling = Math.min(...input.variants.map((v) => v.sellingPrice));
        const outlet = isOutletPrice(input.tagPrice, minSelling);

        // 4. Product(스타일) 생성
        const product = await tx.product.create({
            data: {
                styleCode,
                name: input.name,
                year: input.year,
                season: input.season,
                categoryId: category.id,
                brandId: input.brandId || null,
                tagPrice: input.tagPrice,
                costPrice: input.costPrice,
                isOutlet: outlet,
                status: 'DRAFT',
                material: input.material || null,
                careGuide: input.careGuide || null,
                measurements: input.measurements || null,
                description: input.description || null,
            },
        });

        // 5. Variant(색상별) + Option(SKU) 생성
        const variants = [];
        for (const v of input.variants) {
            const discountRate = calcDiscountRate(input.tagPrice, v.sellingPrice);

            const variant = await tx.productVariant.create({
                data: {
                    productId: product.id,
                    colorCode: v.colorCode.toUpperCase(),
                    colorName: v.colorName || inferColorName(v.colorCode),
                    sellingPrice: v.sellingPrice,
                    discountRate,
                },
            });

            // SKU 자동 생성
            const skus = generateSKUs(styleCode, v.colorCode.toUpperCase(), v.sizes);
            const options = await Promise.all(
                skus.map((sku) =>
                    tx.productOption.create({
                        data: {
                            variantId: variant.id,
                            skuCode: sku.skuCode,
                            size: sku.size,
                            sizeLabel: sku.sizeLabel,
                            sizeSuffix: sku.sizeSuffix,
                            status: 'ACTIVE',
                        },
                    }),
                ),
            );

            variants.push({ ...variant, options });
        }

        // 6. 가격 이력 최초 기록
        await tx.priceHistory.create({
            data: {
                productId: product.id,
                changeType: 'TAG',
                prevPrice: 0,
                newPrice: input.tagPrice,
                reason: '신규 등록',
            },
        });

        return { product, variants };
    });
}

// ─── 상품 목록 조회 (스타일 기준) ───

export async function listProducts(filter: ProductListFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    // 동적 WHERE 조건 구성
    const where: Record<string, unknown> = {};
    if (filter.year) where.year = filter.year;
    if (filter.season) where.season = filter.season;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.status) where.status = filter.status;
    if (filter.isOutlet !== undefined) where.isOutlet = filter.isOutlet;
    if (filter.search) {
        where.OR = [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { styleCode: { contains: filter.search, mode: 'insensitive' } },
        ];
    }

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                category: true,
                variants: {
                    include: {
                        options: {
                            include: {
                                inventoryLocations: true,
                            },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.product.count({ where }),
    ]);

    return {
        products,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// ─── 상품 상세 조회 ───

export async function getProductById(id: string) {
    return prisma.product.findUnique({
        where: { id },
        include: {
            category: true,
            brand: true,
            variants: {
                include: {
                    options: {
                        include: { inventoryLocations: true },
                        orderBy: { sizeSuffix: 'asc' },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            },
            priceHistory: {
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
        },
    });
}

// ─── 상품 상태 변경 (DRAFT ↔ ACTIVE 등) ───

export async function updateProductStatus(id: string, status: ProductStatus) {
    return prisma.product.update({
        where: { id },
        data: { status },
    });
}

// ─── 판매가 변경 + 아울렛 자동 플래그 ───

export async function updateVariantPrice(
    variantId: string,
    newSellingPrice: number,
) {
    const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: variantId },
        include: { product: true },
    });

    const discountRate = calcDiscountRate(variant.product.tagPrice, newSellingPrice);

    // Variant 가격 업데이트
    await prisma.productVariant.update({
        where: { id: variantId },
        data: { sellingPrice: newSellingPrice, discountRate },
    });

    // 가격 이력 기록
    await prisma.priceHistory.create({
        data: {
            productId: variant.product.id,
            changeType: 'SELLING',
            prevPrice: variant.sellingPrice,
            newPrice: newSellingPrice,
            reason: isOutletPrice(variant.product.tagPrice, newSellingPrice)
                ? '아울렛 전환 (50% 이상 할인)'
                : '판매가 변경',
        },
    });

    // 모든 Variant의 최소 판매가 기준으로 Product 아울렛 플래그 갱신
    const allVariants = await prisma.productVariant.findMany({
        where: { productId: variant.product.id },
        select: { sellingPrice: true },
    });
    const minSelling = Math.min(...allVariants.map((v) => v.sellingPrice));
    const outlet = isOutletPrice(variant.product.tagPrice, minSelling);

    return prisma.product.update({
        where: { id: variant.product.id },
        data: { isOutlet: outlet },
    });
}

// ─── 품절 자동 처리 (재고 차감 후 호출) ───

export async function checkAndUpdateSoldOut(productOptionId: string) {
    // 해당 SKU의 전체 창고 재고 합산
    const totalStock = await prisma.inventoryLocation.aggregate({
        where: { productOptionId },
        _sum: { quantity: true },
    });

    if ((totalStock._sum.quantity ?? 0) <= 0) {
        // SKU 품절 처리
        const option = await prisma.productOption.update({
            where: { id: productOptionId },
            data: { status: 'SOLD_OUT' },
            include: { variant: true },
        });

        // 해당 Variant의 모든 Option이 품절인지 확인
        const activeOptions = await prisma.productOption.count({
            where: {
                variantId: option.variantId,
                status: 'ACTIVE',
            },
        });

        if (activeOptions === 0) {
            // 해당 색상의 모든 SKU가 품절 → Product 전체 확인
            const variant = await prisma.productVariant.findUniqueOrThrow({
                where: { id: option.variantId },
            });

            const activeInProduct = await prisma.productOption.count({
                where: {
                    variant: { productId: variant.productId },
                    status: 'ACTIVE',
                },
            });

            if (activeInProduct === 0) {
                // 전체 SKU 품절 → Product도 SOLD_OUT
                await prisma.product.update({
                    where: { id: variant.productId },
                    data: { status: 'SOLD_OUT' },
                });
            }
        }
    }
}

// ─── 상품 삭제 (Cascade) ───

export async function deleteProduct(id: string) {
    // Variant, Option 모두 Cascade 삭제됨 (스키마에 onDelete: Cascade 설정)
    return prisma.product.delete({ where: { id } });
}
