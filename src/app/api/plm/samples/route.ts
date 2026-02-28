import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 샘플 목록 조회
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabase.from('samples').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 샘플 생성
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();
    const { data: { session } } = await supabase.auth.getSession();
    const { data: emp } = await supabase.from('employees').select('name').eq('email', session?.user?.email || '').maybeSingle();

    const { data, error } = await supabase
        .from('samples')
        .insert({ ...body, created_by: emp?.name || '알 수 없음' })
        .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 샘플 상태 수정
export async function PATCH(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id, ...updates } = await req.json();

    const { data, error } = await supabase
        .from('samples')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 샘플 삭제
export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id } = await req.json();
    const { error } = await supabase.from('samples').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '삭제 완료' });
}
