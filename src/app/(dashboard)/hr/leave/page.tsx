import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import LeaveDashboardClient from './components/LeaveDashboardClient';

export default async function LeaveDashboardPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/');
    }

    const currentEmail = session.user.email;

    // 현재 사용자(employee) 정보 조회 (잔여 연차, 권한 등)
    const { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', currentEmail)
        .single();

    if (userError || !currentUser) {
        return <div className="p-8 text-red-600">사용자 정보를 찾을 수 없습니다.</div>;
    }

    // 나의 휴가 신청 내역 조회 (최신순)
    const { data: myRequests } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', currentUser.id)
        .order('created_at', { ascending: false });

    // 관리자(master) 기능: 모든 직원의 대기 중[pending]인 신청 건 조회
    let allPendingRequests = [];
    if (currentUser.role === 'master') {
        const { data: pendingData } = await supabase
            .from('leave_requests')
            .select(`
                *,
                employee:employees ( id, name, department )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true }); // 오래된 순서대로 위로 오게

        if (pendingData) {
            allPendingRequests = pendingData;
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">휴가 결재 보드</h1>
                <p className="text-slate-500 text-sm mt-1">전자 결재 및 나의 연차 내역을 관리합니다.</p>
            </div>

            <LeaveDashboardClient
                currentUser={currentUser}
                myRequests={myRequests || []}
                allPendingRequests={allPendingRequests}
            />
        </div>
    );
}
