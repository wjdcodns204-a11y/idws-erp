import { createSupabaseServer } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

// 메인 대시보드 — Supabase에서 실시간 데이터를 가져와서 렌더링
export default async function DashboardPage() {
    const supabase = await createSupabaseServer();

    // 병렬로 데이터 조회
    const [
        { data: products },
        { data: csRequests },
        { data: employees },
        { data: salesGoal },
        { data: kpiSettings },
    ] = await Promise.all([
        supabase
            .from('products')
            .select('id, name, sku, stock_quantity, cost_price, display_status, category, season')
            .eq('display_status', 'active'),
        supabase
            .from('cs_requests')
            .select('id, status, created_at, platform')
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('employees')
            .select('id, name, department'),
        supabase
            .from('sales_goals')
            .select('goal_amount, platform, year')
            .eq('year', new Date().getFullYear())
            .eq('platform', '전체')
            .maybeSingle(),
        supabase
            .from('dashboard_kpi')
            .select('*')
            .maybeSingle(),
    ]);

    // ─── 재고 요약 계산 ───
    const allProducts = products || [];
    const totalStock = allProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
    const totalAsset = allProducts.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0);

    // 시즌별 집계
    const seasonMap: Record<string, { qty: number; value: number }> = {};
    for (const p of allProducts) {
        const s = p.season || '기타';
        if (!seasonMap[s]) seasonMap[s] = { qty: 0, value: 0 };
        seasonMap[s].qty += p.stock_quantity || 0;
        seasonMap[s].value += (p.stock_quantity || 0) * (p.cost_price || 0);
    }
    const seasons = Object.entries(seasonMap)
        .map(([season, data]) => ({
            season,
            qty: data.qty,
            value: data.value,
            percent: totalAsset > 0 ? Math.round((data.value / totalAsset) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.value - a.value);

    // 재고 부족 상품 (20개 이하)
    const lowStockItems = allProducts
        .filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= 20)
        .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0))
        .slice(0, 5);

    // ─── CS 요약 ───
    const allCs = csRequests || [];
    const today = new Date().toISOString().slice(0, 10);
    const csPending = allCs.filter(c => c.status === '신규' || c.status === '처리중');
    const csToday = allCs.filter(c => c.created_at?.startsWith(today));

    // ─── 목표 ───
    const annualGoal = (salesGoal as { goal_amount: number } | null)?.goal_amount || 2_520_000_000;
    const monthlyGoal = kpiSettings?.monthly_goal || Math.round(annualGoal / 12);

    return (
        <DashboardClient
            inventorySummary={{
                totalStock,
                totalAsset,
                productCount: allProducts.length,
                seasons,
                lowStockItems: lowStockItems.map(p => ({
                    sku: p.sku || '',
                    name: p.name || '',
                    stock: p.stock_quantity || 0,
                    category: p.category || '',
                })),
            }}
            csSummary={{
                todayCount: csToday.length,
                pendingCount: csPending.length,
                totalCount: allCs.length,
            }}
            hrSummary={{
                headCount: (employees || []).length,
            }}
            goals={{
                monthlyGoal,
                annualGoal,
            }}
            updatedAt={new Date().toISOString()}
        />
    );
}
