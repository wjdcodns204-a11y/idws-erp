// src/app/api/products/import/route.ts
// 엑셀 대량 등록 API — 미리보기(POST preview) & 확정(POST confirm)

import { NextRequest, NextResponse } from 'next/server';
import { parseExcelRows, importProducts, type ParsedProduct } from '@/services/product-import.service';

// POST /api/products/import
// body.action = "preview" → 파싱 결과 미리보기
// body.action = "confirm" → 실제 DB 저장
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, rows, products: confirmedProducts } = body;

        if (action === 'preview') {
            // 엑셀 데이터를 파싱하여 미리보기 반환
            if (!Array.isArray(rows) || rows.length === 0) {
                return NextResponse.json(
                    { error: '엑셀 데이터가 비어있습니다.' },
                    { status: 400 },
                );
            }

            const preview = parseExcelRows(rows);
            return NextResponse.json(preview);
        }

        if (action === 'confirm') {
            // 미리보기에서 확인된 상품을 실제 DB에 저장
            if (!Array.isArray(confirmedProducts) || confirmedProducts.length === 0) {
                return NextResponse.json(
                    { error: '저장할 상품이 없습니다.' },
                    { status: 400 },
                );
            }

            const result = await importProducts(confirmedProducts as ParsedProduct[]);
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { error: 'action은 "preview" 또는 "confirm" 이어야 합니다.' },
            { status: 400 },
        );
    } catch (error) {
        console.error('[엑셀 임포트 오류]', error);
        const message = error instanceof Error ? error.message : '엑셀 임포트에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
