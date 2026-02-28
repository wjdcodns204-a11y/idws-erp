import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 활동 로그 조회 (관리자용)
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || '100');
    const resource = searchParams.get('resource');
    const action = searchParams.get('action');

    let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (resource) query = query.eq('resource', resource);
    if (action) query = query.eq('action', action);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 활동 로그 기록
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from('activity_logs').insert({
        user_email: session?.user?.email || body.user_email || '알 수 없음',
        user_name: body.user_name,
        action: body.action,
        resource: body.resource,
        resource_id: body.resource_id || null,
        description: body.description,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
        metadata: body.metadata || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '로그 기록 완료' });
}
