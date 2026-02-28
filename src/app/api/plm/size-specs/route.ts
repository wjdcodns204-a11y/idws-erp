import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 사이즈 스펙 조회
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get('sku');
    const season = searchParams.get('season');

    let query = supabase.from('size_specs').select('*').order('product_name');
    if (sku) query = query.eq('sku', sku);
    if (season) query = query.eq('season', season);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 사이즈 스펙 저장
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();
    const { data, error } = await supabase
        .from('size_specs').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 사이즈 스펙 삭제
export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id } = await req.json();
    const { error } = await supabase.from('size_specs').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '삭제 완료' });
}
