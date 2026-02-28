import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import AppraisalDashboardClient from './components/AppraisalDashboardClient';

export default async function AppraisalPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) redirect('/');

    const currentEmail = session.user.email;
    const { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', currentEmail)
        .single();

    if (userError || !currentUser) {
        return <div className="p-8 text-red-600">사용자 정보를 찾을 수 없습니다.</div>;
    }

    // Master만 접근 가능
    if (currentUser.role !== 'master') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center border-4 border-red-50">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">접근 권한이 없습니다</h2>
                    <p className="text-slate-500 text-sm mt-1">성과 관리 메뉴는 대표 관리자(Master)만 열람할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    const { data: employees } = await supabase
        .from('employees')
        .select('id, name, department')
        .eq('employee_status', 'active')
        .neq('id', currentUser.id) // 자기 자신 제외
        .order('name', { ascending: true });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">성과 / 다면 평가</h1>
                <p className="text-slate-500 text-sm mt-1">직원의 업무 달성도, 커뮤니케이션, 문제 해결력을 항목별로 점수를 매겨 기록합니다.</p>
            </div>

            <AppraisalDashboardClient employees={employees || []} />
        </div>
    );
}
