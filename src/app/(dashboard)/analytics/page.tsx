import { createSupabaseServer } from '@/lib/supabase';
import AnalyticsClient from './AnalyticsClient';

export default async function AnalyticsPage() {
    const supabase = await createSupabaseServer();

    // 최근 6개월 데이터 미리 로드
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().slice(0, 7));
    }

    const [{ data: revenues }, { data: expenses }, { data: csRequests }] = await Promise.all([
        supabase.from('revenue_records').select('*').in('year_month', months),
        supabase.from('expense_records').select('*').in('year_month', months),
        supabase.from('cs_requests').select('platform, request_type, status, created_at').gte('created_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return (
        <AnalyticsClient
            initialRevenues={revenues || []}
            initialExpenses={expenses || []}
            initialCsRequests={csRequests || []}
            months={months}
        />
    );
}
