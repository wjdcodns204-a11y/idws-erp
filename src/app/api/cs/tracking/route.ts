import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// CS 운송장 및 배송 정보 업데이트
export async function PATCH(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data, error } = await supabase
        .from('cs_requests')
        .update({
            tracking_number: body.tracking_number,
            carrier: body.carrier,
            exchange_item: body.exchange_item || null,
            refund_amount: body.refund_amount || 0,
            status: body.status || undefined,
        })
        .eq('id', body.id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
