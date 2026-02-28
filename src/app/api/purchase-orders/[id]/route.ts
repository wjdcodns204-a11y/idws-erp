import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 발주서 상태 변경 (승인, 발주완료, 입고완료 등)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createSupabaseServer();
    const { id } = await params;
    const body = await req.json();

    const { data: { session } } = await supabase.auth.getSession();
    const { data: emp } = await supabase
        .from('employees').select('name')
        .eq('email', session?.user?.email || '').maybeSingle();

    const updateData: Record<string, string | null> = { status: body.status };

    // 승인 처리
    if (body.status === '발주완료') {
        updateData.approved_by = emp?.name || session?.user?.email || '알 수 없음';
        updateData.ordered_date = new Date().toISOString().slice(0, 10);
    }
    // 입고 완료 처리
    if (body.status === '입고완료') {
        updateData.received_date = new Date().toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 발주서 삭제 (초안 상태만 가능)
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createSupabaseServer();
    const { id } = await params;

    const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', id).single();
    if (po?.status !== '초안' && po?.status !== '승인대기') {
        return NextResponse.json({ error: '진행 중인 발주서는 삭제할 수 없습니다.' }, { status: 400 });
    }

    await supabase.from('purchase_order_items').delete().eq('po_id', id);
    await supabase.from('purchase_orders').delete().eq('id', id);
    return NextResponse.json({ message: '발주서 삭제 완료' });
}
