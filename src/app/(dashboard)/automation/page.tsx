import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import AutomationDashboardClient from './components/AutomationDashboardClient';

const JOB_NAMES = ['이지어드민 재고', '이지어드민 주문', '카페24'];

export default async function AutomationPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    // 권한 체크 (이메일 기준 — 실제 이메일로 수정 필요)
    // 현재는 모든 로그인 유저 허용 → 추후 이메일 기준 제한 가능

    // 각 작업별 최신 기록 조회 (성공/실패 각 1건씩)
    const jobDataMap: Record<string, { last_success: string | null; last_failure: string | null; last_error: string | null }> = {};

    for (const job of JOB_NAMES) {
        const { data: latest } = await supabase
            .from('automation_alerts')
            .select('status, error_message, created_at')
            .eq('job_name', job)
            .order('created_at', { ascending: false })
            .limit(5);

        const lastSuccess = latest?.find(r => r.status === 'success');
        const lastFailure = latest?.find(r => r.status === 'failure');

        jobDataMap[job] = {
            last_success: lastSuccess?.created_at || null,
            last_failure: lastFailure?.created_at || null,
            last_error: lastFailure?.error_message || null,
        };
    }

    // 미읽은 실패 알림 수 (읽음 처리)
    const { count: unreadCount } = await supabase
        .from('automation_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failure')
        .eq('is_read', false);

    // 현황판 방문 시 자동 읽음 처리
    await supabase
        .from('automation_alerts')
        .update({ is_read: true })
        .eq('is_read', false);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">자동화 모니터링</h1>
                    <p className="text-slate-500 text-sm mt-1">자동화 작업의 실행 현황을 확인하세요.</p>
                </div>
                {(unreadCount || 0) > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-bold text-red-600">미확인 실패 {unreadCount}건</span>
                    </div>
                )}
            </div>
            <AutomationDashboardClient jobDataMap={jobDataMap} jobNames={JOB_NAMES} />
        </div>
    );
}
