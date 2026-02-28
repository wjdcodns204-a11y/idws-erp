import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 종합 분석 데이터 API
// - 채널별 수익성 (#43)
// - 상품별 마진 분석 (#44)  
// - 반품률 추이 (#48)
// - 월간 요약 리포트 (#42)
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '6'; // 최근 N개월

    // 최근 N개월 year_month 목록 생성
    const months: string[] = [];
    for (let i = Number(period) - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().slice(0, 7));
    }

    const [
        { data: revenues },
        { data: expenses },
        { data: csRequests },
        { data: orders },
    ] = await Promise.all([
        supabase.from('revenue_records').select('*').in('year_month', months),
        supabase.from('expense_records').select('*').in('year_month', months),
        supabase.from('cs_requests').select('platform, request_type, created_at, status').gte('created_at', new Date(Date.now() - Number(period) * 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('orders').select('platform, total_amount, created_at').gte('created_at', new Date(Date.now() - Number(period) * 30 * 24 * 60 * 60 * 1000).toISOString()).limit(5000),
    ]);

    const revList = revenues || [];
    const expList = expenses || [];
    const csList = csRequests || [];

    // ① 채널별 수익성 집계
    const channelMap = new Map<string, {
        platform: string; grossSales: number; returns: number;
        fees: number; netRevenue: number; csCount: number; returnCount: number;
    }>();

    for (const r of revList) {
        const existing = channelMap.get(r.platform) || {
            platform: r.platform, grossSales: 0, returns: 0, fees: 0,
            netRevenue: 0, csCount: 0, returnCount: 0
        };
        existing.grossSales += r.gross_sales || 0;
        existing.returns += r.returns_amount || 0;
        existing.fees += r.platform_fee || 0;
        existing.netRevenue += (r.net_sales || 0) - (r.platform_fee || 0);
        channelMap.set(r.platform, existing);
    }
    for (const cs of csList) {
        const ch = channelMap.get(cs.platform);
        if (ch) {
            ch.csCount++;
            if (cs.request_type === '반품') ch.returnCount++;
        }
    }

    const channelStats = Array.from(channelMap.values()).map(ch => ({
        ...ch,
        returnRate: ch.grossSales > 0 ? Math.round((ch.returns / ch.grossSales) * 100) : 0,
        profitMargin: ch.grossSales > 0 ? Math.round((ch.netRevenue / ch.grossSales) * 100) : 0,
    })).sort((a, b) => b.netRevenue - a.netRevenue);

    // ② 월별 매출 추이
    const monthlyTrend = months.map(m => {
        const monthRevs = revList.filter(r => r.year_month === m);
        const monthExps = expList.filter(e => e.year_month === m);
        const grossSales = monthRevs.reduce((s, r) => s + (r.gross_sales || 0), 0);
        const netRevenue = monthRevs.reduce((s, r) => s + (r.net_sales || 0), 0);
        const fees = monthRevs.reduce((s, r) => s + (r.platform_fee || 0), 0);
        const totalExpenses = monthExps.reduce((s, e) => s + (e.amount || 0), 0);
        const operatingProfit = netRevenue - fees - totalExpenses;
        return {
            month: m,
            grossSales,
            netRevenue,
            fees,
            totalExpenses,
            operatingProfit,
            margin: netRevenue > 0 ? Math.round((operatingProfit / netRevenue) * 100) : 0,
        };
    });

    // ③ 비용 카테고리별 합계
    const expenseCategoryMap = new Map<string, number>();
    for (const e of expList) {
        expenseCategoryMap.set(e.category, (expenseCategoryMap.get(e.category) || 0) + e.amount);
    }
    const expenseBreakdown = Array.from(expenseCategoryMap.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);

    // ④ CS/반품률 플랫폼별
    const platformCsMap = new Map<string, { total: number; returns: number; exchanges: number; completed: number }>();
    for (const cs of csList) {
        const existing = platformCsMap.get(cs.platform) || { total: 0, returns: 0, exchanges: 0, completed: 0 };
        existing.total++;
        if (cs.request_type === '반품') existing.returns++;
        if (cs.request_type === '교환') existing.exchanges++;
        if (cs.status === '완료') existing.completed++;
        platformCsMap.set(cs.platform, existing);
    }
    const csStats = Array.from(platformCsMap.entries()).map(([platform, stats]) => ({
        platform,
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }));

    return NextResponse.json({
        period: Number(period),
        months,
        channelStats,
        monthlyTrend,
        expenseBreakdown,
        csStats,
        summary: {
            totalRevenue: revList.reduce((s, r) => s + (r.gross_sales || 0), 0),
            totalNetRevenue: revList.reduce((s, r) => s + (r.net_sales || 0), 0),
            totalFees: revList.reduce((s, r) => s + (r.platform_fee || 0), 0),
            totalExpenses: expList.reduce((s, e) => s + (e.amount || 0), 0),
            totalCsCount: csList.length,
            totalReturnCount: csList.filter(c => c.request_type === '반품').length,
        },
    });
}
