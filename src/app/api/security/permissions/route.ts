import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 특정 사용자의 전체 권한 목록 조회
export async function GET() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: '인증되지 않은 사용자' }, { status: 401 });

    // 사용자 역할 조회
    const { data: emp } = await supabase
        .from('employees')
        .select('role')
        .eq('email', session.user.email || '')
        .maybeSingle();

    const role = emp?.role || 'staff';

    // 해당 역할의 권한 조회
    const { data: permissions, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', role);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 메뉴키 → 권한 맵으로 변환
    const permissionMap = Object.fromEntries(
        (permissions || []).map(p => [p.menu_key, {
            canView: p.can_view,
            canCreate: p.can_create,
            canEdit: p.can_edit,
            canDelete: p.can_delete,
        }])
    );

    return NextResponse.json({ role, permissions: permissionMap });
}

// 권한 수정 (admin 전용)
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { data: emp } = await supabase
        .from('employees').select('role').eq('email', session.user.email || '').maybeSingle();

    if (emp?.role !== 'admin') return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });

    const body = await req.json(); // { role, menu_key, can_view, can_create, can_edit, can_delete }

    const { data, error } = await supabase
        .from('role_permissions')
        .upsert({
            role: body.role,
            menu_key: body.menu_key,
            can_view: body.can_view ?? false,
            can_create: body.can_create ?? false,
            can_edit: body.can_edit ?? false,
            can_delete: body.can_delete ?? false,
        }, { onConflict: 'role,menu_key' })
        .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 권한 변경 로그 기록
    await supabase.from('activity_logs').insert({
        user_email: session.user.email || '',
        action: 'update',
        resource: 'role_permissions',
        description: `'${body.role}' 역할의 '${body.menu_key}' 메뉴 권한 수정`,
    });

    return NextResponse.json(data);
}
