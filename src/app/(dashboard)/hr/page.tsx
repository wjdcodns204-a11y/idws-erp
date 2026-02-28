import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import HrDashboardClient from './components/HrDashboardClient';

export default async function HrDashboardPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/');
    }

    const currentEmail = session.user.email;

    const { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', currentEmail)
        .single();

    if (userError || !currentUser) {
        return <div className="p-8 text-red-600">사용자 정보를 찾을 수 없습니다.</div>;
    }

    // 보안 검사: master 권한 또는 정채운 이메일만 접근 가능
    const ADMIN_EMAILS = ['wjdcodns204@idontwannasell.com'];
    const hasAccess = currentUser.role === 'master' || ADMIN_EMAILS.includes(currentUser.email || '');

    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center border-4 border-red-50">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">접근 권한이 없습니다</h2>
                    <p className="text-slate-500 text-sm mt-1">인사/급여 관련 메뉴는 대표 관리자(Master)만 열람할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    // 직원 전체 목록 (마스터용)
    const { data: allEmployees } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">통합 인사 카드 관리</h1>
                <p className="text-slate-500 text-sm mt-1">직원들의 기본 정보와 연봉, 계약서, 상태(퇴사 등)를 총괄 관리합니다.</p>
            </div>

            <HrDashboardClient
                employees={allEmployees || []}
            />
        </div>
    );
}
