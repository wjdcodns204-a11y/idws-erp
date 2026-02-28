// src/app/api/products/[id]/route.ts
// 상품 상세 조회(GET) · 수정(PATCH) · 삭제(DELETE)

import { NextRequest, NextResponse } from 'next/server';
import {
    getProductById,
    updateProductStatus,
    updateVariantPrice,
    deleteProduct,
} from '@/services/product.service';

interface RouteContext {
    params: Promise<{ id: string }>;
}

// GET /api/products/:id — 상세 조회
export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const product = await getProductById(id);
        if (!product) {
            return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
        }
        return NextResponse.json(product);
    } catch (error) {
        console.error('[상품 상세 조회 오류]', error);
        return NextResponse.json({ error: '상품 조회에 실패했습니다.' }, { status: 500 });
    }
}

// PATCH /api/products/:id — 상태 변경 또는 가격 변경
export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await req.json();

        // 상태 변경
        if (body.status) {
            const updated = await updateProductStatus(id, body.status);
            return NextResponse.json(updated);
        }

        // Variant 판매가 변경
        if (body.variantId && body.sellingPrice) {
            const updated = await updateVariantPrice(body.variantId, body.sellingPrice);
            return NextResponse.json(updated);
        }

        return NextResponse.json(
            { error: '변경할 항목을 지정해 주세요. (status 또는 variantId+sellingPrice)' },
            { status: 400 },
        );
    } catch (error) {
        console.error('[상품 수정 오류]', error);
        return NextResponse.json({ error: '상품 수정에 실패했습니다.' }, { status: 500 });
    }
}

// DELETE /api/products/:id — 삭제
export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        await deleteProduct(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[상품 삭제 오류]', error);
        return NextResponse.json({ error: '상품 삭제에 실패했습니다.' }, { status: 500 });
    }
}
