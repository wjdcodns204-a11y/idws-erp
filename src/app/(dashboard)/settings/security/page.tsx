import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import SecurityClient from './SecurityClient';

export default async function SecurityPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    // 관리자만 접근 가능
    const { data: currentUser } = await supabase
        .from('employees')
        .select('role, name')
        .eq('email', session.user.email || '')
        .maybeSingle();

    if (currentUser?.role !== 'admin') redirect('/');

    const [
        { data: permissions },
        { data: activityLogs },
        { data: employees },
    ] = await Promise.all([
        supabase.from('role_permissions').select('*').order('role').order('menu_key'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('employees').select('name, email, role, department').eq('status', 'active').order('name'),
    ]);

    return (
        <SecurityClient
            currentUserRole={currentUser?.role || 'admin'}
            initialPermissions={permissions || []}
            initialLogs={activityLogs || []}
            employees={employees || []}
        />
    );
}
