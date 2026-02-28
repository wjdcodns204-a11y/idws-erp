import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import AnalyticsDashboardClient from './components/AnalyticsDashboardClient';

export default async function AnalyticsPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    const thisYear = new Date().getFullYear();

    // 매출 목표 조회
    const { data: goals } = await supabase
        .from('sales_goals')
        .select('*')
        .eq('year', thisYear);

    // 이번 달 & 작년 동월 매출 집계 (sales_rows API 호출로 처리)
    const thisMonth = new Date().getMonth() + 1;
    const lastYear = thisYear - 1;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">매출 분석 대시보드</h1>
                <p className="text-slate-500 text-sm mt-1">플랫폼별 매출 추세, 목표 달성률, 상품 랭킹을 한눈에 확인하세요.</p>
            </div>

            <AnalyticsDashboardClient
                goals={goals || []}
                thisYear={thisYear}
                thisMonth={thisMonth}
                lastYear={lastYear}
            />
        </div>
    );
}
