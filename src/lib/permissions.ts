/**
 * 권한 확인 유틸리티
 * 서버 컴포넌트 및 API 라우트에서 사용자 권한을 검증할 때 사용
 */
import { createSupabaseServer } from '@/lib/supabase';

export type Permission = {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
};

export type UserInfo = {
    email: string;
    role: 'admin' | 'leader' | 'staff';
    name: string;
    department: string;
};

/**
 * 현재 로그인된 사용자의 역할과 기본 정보를 반환합니다.
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return null;

    const { data: emp } = await supabase
        .from('employees')
        .select('role, name, department')
        .eq('email', session.user.email)
        .maybeSingle();

    return {
        email: session.user.email,
        role: (emp?.role as 'admin' | 'leader' | 'staff') || 'staff',
        name: emp?.name || session.user.email,
        department: emp?.department || '',
    };
}

/**
 * 특정 메뉴에 대한 권한을 확인합니다.
 * @param menuKey 메뉴 식별자 (예: 'finance', 'hr_payroll')
 */
export async function checkPermission(menuKey: string): Promise<Permission> {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return { canView: false, canCreate: false, canEdit: false, canDelete: false };

    const { data: emp } = await supabase
        .from('employees').select('role').eq('email', session.user.email).maybeSingle();
    const role = emp?.role || 'staff';

    // admin은 항상 모든 권한
    if (role === 'admin') return { canView: true, canCreate: true, canEdit: true, canDelete: true };

    const { data: perm } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', role)
        .eq('menu_key', menuKey)
        .maybeSingle();

    return {
        canView: perm?.can_view ?? false,
        canCreate: perm?.can_create ?? false,
        canEdit: perm?.can_edit ?? false,
        canDelete: perm?.can_delete ?? false,
    };
}

/**
 * 활동 로그를 기록하는 서버 유틸
 */
export async function logActivity(params: {
    action: string;
    resource: string;
    resourceId?: string;
    description: string;
    metadata?: Record<string, unknown>;
}) {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    const { data: emp } = await supabase.from('employees').select('name').eq('email', session?.user?.email || '').maybeSingle();

    await supabase.from('activity_logs').insert({
        user_email: session?.user?.email || '시스템',
        user_name: emp?.name || null,
        action: params.action,
        resource: params.resource,
        resource_id: params.resourceId || null,
        description: params.description,
        metadata: params.metadata || null,
    });
}
