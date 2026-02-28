import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 세금계산서 목록 조회
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // '발행' | '수령' | null

    let query = supabase.from('tax_invoices').select('*').order('invoice_date', { ascending: false });
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 세금계산서 생성
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data, error } = await supabase
        .from('tax_invoices')
        .insert({
            type: body.type,
            invoice_date: body.invoice_date,
            company_name: body.company_name,
            business_number: body.business_number || null,
            amount: body.amount,
            item_description: body.item_description || null,
            memo: body.memo || null,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 세금계산서 상태 변경 / 삭제
export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id } = await req.json();
    const { error } = await supabase.from('tax_invoices').update({ status: '취소' }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '취소 처리 완료' });
}
