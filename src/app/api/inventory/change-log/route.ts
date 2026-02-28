import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { sku, productName, reason, quantityDelta, warehouse, memo } = await request.json();

        if (!sku || !reason || quantityDelta === undefined) {
            return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        const { error } = await supabase
            .from('inventory_change_logs')
            .insert({
                sku,
                product_name: productName || null,
                reason,
                quantity_delta: quantityDelta,
                warehouse: warehouse || '이지어드민 창고',
                memo: memo || null,
            });

        if (error) {
            console.error('DB 저장 실패:', error);
            return NextResponse.json({ error: 'DB 저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
