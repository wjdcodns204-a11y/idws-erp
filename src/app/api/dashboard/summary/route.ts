import { createSupabaseServer } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// 대시보드 실시간 요약 API
// 재고, CS, 직원 수 등 Supabase에서 실시간으로 가져옴
export async function GET() {
    try {
        const supabase = await createSupabaseServer();

        // 병렬로 데이터 조회
        const [
            { data: products, error: prodErr },
            { data: csRequests, error: csErr },
            { data: employees, error: empErr },
            { data: salesGoal, error: goalErr },
            { data: inventoryLogs, error: logErr },
        ] = await Promise.all([
            supabase
                .from('products')
                .select('id, name, sku, stock_quantity, cost_price, display_status, category, season')
                .eq('display_status', 'active'),
            supabase
                .from('cs_requests')
                .select('id, status, created_at, platform')
                .order('created_at', { ascending: false }),
            supabase
                .from('employees')
                .select('id, name, department')
                .neq('role', 'inactive'),
            supabase
                .from('sales_goals')
                .select('goal_amount, platform, year')
                .eq('year', new Date().getFullYear())
                .eq('platform', '전체')
                .single(),
            supabase
                .from('inventory_change_logs')
                .select('quantity_delta, reason, created_at')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ]);

        if (prodErr && prodErr.code !== 'PGRST116') console.error('products error:', prodErr);
        if (csErr) console.error('cs error:', csErr);
        if (empErr) console.error('employees error:', empErr);

        // ─── 재고 요약 ───
        const totalStock = (products || []).reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
        const totalAsset = (products || []).reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0);

        // 재고 부족 상품 (20개 이하)
        const lowStockItems = (products || [])
            .filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= 20)
            .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0))
            .slice(0, 10);

        // 시즌별 집계
        const seasonMap: Record<string, { qty: number; value: number }> = {};
        for (const p of (products || [])) {
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

        // ─── CS 요약 ───
        const allCs = csRequests || [];
        const today = new Date().toISOString().slice(0, 10);
        const csToday = allCs.filter(c => c.created_at.startsWith(today));
        const csPending = allCs.filter(c => c.status === '신규' || c.status === '처리중');

        // ─── 직원 수 ───
        const headCount = (employees || []).length;

        // ─── 매출 목표 ───
        const annualGoal = (salesGoal as { goal_amount: number } | null)?.goal_amount || 0;
        const monthlyGoal = Math.round(annualGoal / 12);

        // ─── 입출고 요약 (최근 30일) ───
        const inbound = (inventoryLogs || []).filter(l => (l.quantity_delta || 0) > 0).reduce((s, l) => s + l.quantity_delta, 0);
        const outbound = Math.abs((inventoryLogs || []).filter(l => (l.quantity_delta || 0) < 0).reduce((s, l) => s + l.quantity_delta, 0));

        return NextResponse.json({
            updatedAt: new Date().toISOString(),
            inventory: {
                totalStock,
                totalAsset,
                productCount: (products || []).length,
                seasons,
                lowStockItems: lowStockItems.map(p => ({
                    sku: p.sku,
                    name: p.name,
                    stock: p.stock_quantity,
                    category: p.category,
                })),
                recentInbound: inbound,
                recentOutbound: outbound,
            },
            cs: {
                todayCount: csToday.length,
                pendingCount: csPending.length,
                totalCount: allCs.length,
            },
            hr: {
                headCount,
            },
            goals: {
                annualGoal,
                monthlyGoal,
            },
        });
    } catch (err) {
        console.error('Dashboard API error:', err);
        return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
    }
}
