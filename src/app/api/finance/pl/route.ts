import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 특정 월 손익 데이터 조회
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const yearMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    const [
        { data: revenues },
        { data: expenses },
        { data: budgets },
    ] = await Promise.all([
        supabase.from('revenue_records').select('*').eq('year_month', yearMonth),
        supabase.from('expense_records').select('*').eq('year_month', yearMonth),
        supabase.from('budget_plans').select('*').eq('year_month', yearMonth),
    ]);

    // 집계 계산
    const totalGross = (revenues || []).reduce((s, r) => s + (r.gross_sales || 0), 0);
    const totalReturns = (revenues || []).reduce((s, r) => s + (r.returns_amount || 0), 0);
    const totalFees = (revenues || []).reduce((s, r) => s + (r.platform_fee || 0), 0);
    const netRevenue = totalGross - totalReturns;
    const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
    const grossProfit = netRevenue - totalFees;
    const operatingProfit = grossProfit - totalExpenses;

    return NextResponse.json({
        yearMonth,
        revenues: revenues || [],
        expenses: expenses || [],
        budgets: budgets || [],
        summary: {
            totalGross,
            totalReturns,
            netRevenue,
            totalFees,
            grossProfit,
            totalExpenses,
            operatingProfit,
            profitMargin: netRevenue > 0 ? Math.round((operatingProfit / netRevenue) * 100) : 0,
        },
    });
}
