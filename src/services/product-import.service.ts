// src/services/product-import.service.ts
// 엑셀 대량 등록 서비스 — 파싱 → 미리보기 → DB 저장

import { prisma } from '@/lib/prisma';
import { createProduct, type CreateProductInput } from './product.service';
import { SIZE_MAP, inferColorName } from '@/lib/style-code';
import type { SeasonType } from '@prisma/client';

// ─── 엑셀 파싱 결과 타입 ───

export interface ExcelRow {
    제품명: string;
    시즌: string;        // "SS" | "FW"
    연도: number;        // 2025
    카테고리: string;    // "JK", "PT" 등
    소비자가: number;    // Tag Price
    원가: number;
    색상코드: string;    // "BK"
    색상명?: string;     // "블랙" (선택)
    판매가: number;
    사이즈: string;      // "0,1,2" (쉼표 구분)
}

export interface ParsedProduct {
    name: string;
    year: number;
    season: SeasonType;
    categoryCode: string;
    tagPrice: number;
    costPrice: number;
    variants: {
        colorCode: string;
        colorName: string;
        sellingPrice: number;
        sizes: string[];
    }[];
    // 검증 결과
    errors: string[];
    warnings: string[];
}

export interface ImportPreview {
    products: ParsedProduct[];
    totalProducts: number;
    totalVariants: number;
    totalSKUs: number;
    hasErrors: boolean;
}

export interface ImportResult {
    success: number;
    failed: number;
    errors: { row: number; message: string }[];
}

// ─── 엑셀 행 헤더 매핑 ───

const HEADER_MAP: Record<string, keyof ExcelRow> = {
    '제품명': '제품명',
    '상품명': '제품명',
    'name': '제품명',
    '시즌': '시즌',
    'season': '시즌',
    '연도': '연도',
    'year': '연도',
    '카테고리': '카테고리',
    '복종': '카테고리',
    'category': '카테고리',
    '소비자가': '소비자가',
    'tag가': '소비자가',
    '정가': '소비자가',
    'tag_price': '소비자가',
    '원가': '원가',
    'cost': '원가',
    '색상코드': '색상코드',
    '색상': '색상코드',
    'color': '색상코드',
    '색상명': '색상명',
    'color_name': '색상명',
    '판매가': '판매가',
    'selling_price': '판매가',
    '사이즈': '사이즈',
    'size': '사이즈',
    'sizes': '사이즈',
};

/**
 * 엑셀 데이터를 미리보기용으로 파싱
 * (실제 엑셀 파서는 프론트에서 xlsx 라이브러리로 JSON 변환 후 전달)
 */
export function parseExcelRows(rows: Record<string, unknown>[]): ImportPreview {
    if (!rows.length) {
        return {
            products: [],
            totalProducts: 0,
            totalVariants: 0,
            totalSKUs: 0,
            hasErrors: true,
        };
    }

    // 1단계: 헤더 정규화
    const normalizedRows: ExcelRow[] = rows.map((row) => {
        const normalized: Partial<ExcelRow> = {};
        for (const [key, value] of Object.entries(row)) {
            const normalKey = HEADER_MAP[key.trim().toLowerCase()];
            if (normalKey) {
                (normalized as Record<string, unknown>)[normalKey] = value;
            }
        }
        return normalized as ExcelRow;
    });

    // 2단계: 제품 단위로 그룹핑 (제품명+연도+시즌+카테고리)
    const grouped = new Map<string, ExcelRow[]>();
    for (const row of normalizedRows) {
        const key = `${row.제품명}|${row.연도}|${row.시즌}|${row.카테고리}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
    }

    // 3단계: 파싱 + 검증
    const products: ParsedProduct[] = [];
    let totalVariants = 0;
    let totalSKUs = 0;
    let hasErrors = false;

    for (const [, group] of grouped) {
        const first = group[0];
        const errors: string[] = [];
        const warnings: string[] = [];

        // 필수 필드 검증
        if (!first.제품명) errors.push('제품명이 비어있습니다.');
        if (!first.연도 || isNaN(Number(first.연도))) errors.push('연도가 올바르지 않습니다.');
        if (!['SS', 'FW'].includes(String(first.시즌).toUpperCase())) {
            errors.push(`시즌은 SS 또는 FW만 가능합니다. (입력값: ${first.시즌})`);
        }
        if (!first.카테고리) errors.push('카테고리(복종 코드)가 비어있습니다.');
        if (!first.소비자가 || isNaN(Number(first.소비자가))) errors.push('소비자가가 올바르지 않습니다.');
        if (!first.원가 || isNaN(Number(first.원가))) errors.push('원가가 올바르지 않습니다.');

        // 색상별 Variant 생성
        const variantMap = new Map<string, { colorCode: string; colorName: string; sellingPrice: number; sizes: string[] }>();
        for (const row of group) {
            const cc = String(row.색상코드 || '').toUpperCase().trim();
            if (!cc) {
                errors.push('색상코드가 비어있는 행이 있습니다.');
                continue;
            }

            const sizes = String(row.사이즈 || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            if (!sizes.length) {
                errors.push(`색상 ${cc}의 사이즈가 비어있습니다.`);
                continue;
            }

            // 사이즈 유효성 검증
            for (const s of sizes) {
                if (!SIZE_MAP[s]) {
                    errors.push(`유효하지 않은 사이즈: "${s}" (허용: ${Object.keys(SIZE_MAP).join(', ')})`);
                }
            }

            if (!variantMap.has(cc)) {
                variantMap.set(cc, {
                    colorCode: cc,
                    colorName: String(row.색상명 || '') || inferColorName(cc),
                    sellingPrice: Number(row.판매가) || 0,
                    sizes,
                });
            } else {
                // 같은 색상이 여러 행에 있으면 사이즈 합치기
                const existing = variantMap.get(cc)!;
                for (const s of sizes) {
                    if (!existing.sizes.includes(s)) existing.sizes.push(s);
                }
            }
        }

        const variants = Array.from(variantMap.values());
        totalVariants += variants.length;
        totalSKUs += variants.reduce((sum, v) => sum + v.sizes.length, 0);

        if (errors.length > 0) hasErrors = true;

        // 아울렛 경고
        const tagPrice = Number(first.소비자가);
        for (const v of variants) {
            if (v.sellingPrice > 0 && v.sellingPrice <= tagPrice * 0.5) {
                warnings.push(`${v.colorCode}: 판매가(${v.sellingPrice.toLocaleString()}원)가 정가의 50% 이하 → 아울렛 처리`);
            }
        }

        products.push({
            name: String(first.제품명),
            year: Number(first.연도),
            season: String(first.시즌).toUpperCase() as SeasonType,
            categoryCode: String(first.카테고리).toUpperCase().trim(),
            tagPrice,
            costPrice: Number(first.원가),
            variants,
            errors,
            warnings,
        });
    }

    return {
        products,
        totalProducts: products.length,
        totalVariants,
        totalSKUs,
        hasErrors,
    };
}

/**
 * 미리보기 확인 후 실제 DB에 저장
 */
export async function importProducts(
    parsedProducts: ParsedProduct[],
): Promise<ImportResult> {
    let success = 0;
    let failed = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < parsedProducts.length; i++) {
        const p = parsedProducts[i];

        // 에러가 있는 상품은 건너뜀
        if (p.errors.length > 0) {
            failed++;
            errors.push({ row: i + 1, message: p.errors.join('; ') });
            continue;
        }

        try {
            const input: CreateProductInput = {
                name: p.name,
                year: p.year,
                season: p.season,
                categoryCode: p.categoryCode,
                tagPrice: p.tagPrice,
                costPrice: p.costPrice,
                variants: p.variants,
            };

            await createProduct(input);
            success++;
        } catch (err) {
            failed++;
            const msg = err instanceof Error ? err.message : '알 수 없는 오류';
            errors.push({ row: i + 1, message: msg });
        }
    }

    return { success, failed, errors };
}
