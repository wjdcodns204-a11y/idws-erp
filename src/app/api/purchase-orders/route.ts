import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 발주서 목록 조회
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabase
        .from('purchase_orders')
        .select(`
            *,
            purchase_order_items(id, product_name, sku, quantity, unit_price, received_quantity)
        `)
        .order('created_at', { ascending: false });

    if (status && status !== '전체') {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 새 발주서 생성
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    // 세션에서 작성자 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    const { data: emp } = await supabase
        .from('employees')
        .select('name')
        .eq('email', session?.user?.email || '')
        .maybeSingle();

    // 발주 번호 자동 생성
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .like('po_number', `PO-${year}-%`);

    const poNumber = `PO-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

    // 총 금액 계산
    const totalAmount = (body.items || []).reduce(
        (sum: number, item: { quantity: number; unit_price: number }) =>
            sum + (item.quantity || 0) * (item.unit_price || 0),
        0
    );

    // 발주서 생성
    const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
            po_number: poNumber,
            supplier_name: body.supplier_name,
            supplier_id: body.supplier_id || null,
            status: '승인대기',
            ordered_date: body.ordered_date || new Date().toISOString().slice(0, 10),
            expected_date: body.expected_date,
            total_amount: totalAmount,
            memo: body.memo || null,
            created_by: emp?.name || session?.user?.email || '알 수 없음',
        })
        .select()
        .single();

    if (poError) return NextResponse.json({ error: poError.message }, { status: 500 });

    // 품목 추가
    if (body.items && body.items.length > 0) {
        const items = body.items.map((item: { product_name: string; sku?: string; quantity: number; unit_price: number; memo?: string }) => ({
            po_id: po.id,
            product_name: item.product_name,
            sku: item.sku || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            memo: item.memo || null,
        }));

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(items);

        if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ po, message: `발주서 ${poNumber} 생성 완료` });
}
