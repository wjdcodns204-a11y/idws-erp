import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 원단/소재 공급업체 목록
export async function GET() {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
        .from('fabric_suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 원단공급업체 등록
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();
    const { data, error } = await supabase
        .from('fabric_suppliers').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 원단공급업체 수정
export async function PATCH(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id, ...updates } = await req.json();
    const { data, error } = await supabase
        .from('fabric_suppliers').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
