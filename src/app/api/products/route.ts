// src/app/api/products/route.ts
// 상품 목록 조회(GET) & 상품 등록(POST)

import { NextRequest, NextResponse } from 'next/server';
import { listProducts, createProduct } from '@/services/product.service';
import type { SeasonType, ProductStatus } from '@prisma/client';

// GET /api/products — 상품 목록 조회 (스타일 기준)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const filter = {
            year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
            season: searchParams.get('season') as SeasonType | undefined,
            categoryId: searchParams.get('categoryId') || undefined,
            status: searchParams.get('status') as ProductStatus | undefined,
            isOutlet: searchParams.has('isOutlet')
                ? searchParams.get('isOutlet') === 'true'
                : undefined,
            search: searchParams.get('search') || undefined,
            page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
            limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
        };

        const result = await listProducts(filter);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[상품 목록 조회 오류]', error);
        return NextResponse.json(
            { error: '상품 목록을 불러올 수 없습니다.' },
            { status: 500 },
        );
    }
}

// POST /api/products — 상품 등록
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // 필수 필드 검증
        const required = ['name', 'year', 'season', 'categoryCode', 'tagPrice', 'costPrice', 'variants'];
        for (const field of required) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `필수 항목이 누락되었습니다: ${field}` },
                    { status: 400 },
                );
            }
        }

        if (!Array.isArray(body.variants) || body.variants.length === 0) {
            return NextResponse.json(
                { error: '최소 1개의 색상(Variant)을 등록해야 합니다.' },
                { status: 400 },
            );
        }

        // Variant별 필수 검증
        for (const v of body.variants) {
            if (!v.colorCode || !v.sellingPrice || !v.sizes?.length) {
                return NextResponse.json(
                    { error: '각 색상에는 colorCode, sellingPrice, sizes가 필요합니다.' },
                    { status: 400 },
                );
            }
        }

        const result = await createProduct(body);
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error('[상품 등록 오류]', error);
        const message = error instanceof Error ? error.message : '상품 등록에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
