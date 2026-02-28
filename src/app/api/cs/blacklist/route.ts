import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 블랙리스트 목록 조회
export async function GET() {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
        .from('customer_blacklist')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 블랙리스트 등록
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data: { session } } = await supabase.auth.getSession();
    const { data: emp } = await supabase
        .from('employees').select('name')
        .eq('email', session?.user?.email || '').maybeSingle();

    const { data, error } = await supabase
        .from('customer_blacklist')
        .insert({
            customer_name: body.customer_name,
            platform: body.platform || null,
            reason: body.reason,
            registered_by: emp?.name || '알 수 없음',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 블랙리스트 삭제
export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id } = await req.json();
    const { error } = await supabase.from('customer_blacklist').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '블랙리스트에서 제거되었습니다.' });
}
