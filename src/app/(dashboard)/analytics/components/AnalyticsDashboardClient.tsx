"use client";

import React, { useState, useEffect, useCallback } from 'react';

// ─── 타입 ───
type SalesRow = { period: string; platform: string; totalSales: number; orderCount: number; quantity: number; totalCost: number; totalProfit: number; };
type Goal = { id: string; year: number; platform: string; goal_amount: number; };
type RankMode = 'sales' | 'qty' | 'profit';

const PLATFORM_COLORS: Record<string, string> = {
    '무신사': '#4f46e5', '29CM': '#f97316', '카페24': '#10b981', 'EQL': '#3b82f6',
    '하이버': '#ec4899', '지그재그': '#8b5cf6', 'W컨셉': '#6b7280', '기타': '#94a3b8',
};

function formatKRW(v: number) { return v.toLocaleString() + '원'; }
function formatKRWShort(v: number) {
    if (v >= 100000000) return (v / 100000000).toFixed(1) + '억';
    if (v >= 10000) return (v / 10000).toFixed(0) + '만';
    return v.toLocaleString();
}

// ─── 순수 SVG 라인 차트 ───
function LineSVGChart({ data, platforms, groupBy }: { data: SalesRow[]; platforms: string[]; groupBy: string }) {
    const W = 800, H = 220, PAD = { l: 60, r: 20, t: 20, b: 40 };

    const periods = [...new Set(data.map(d => d.period))].sort();
    if (periods.length === 0) return <div className="text-center text-slate-400 py-12">데이터 없음</div>;

    const byPlatform: Record<string, Record<string, number>> = {};
    for (const row of data) {
        if (!byPlatform[row.platform]) byPlatform[row.platform] = {};
        byPlatform[row.platform][row.period] = row.totalSales;
    }

    const allVals = data.map(d => d.totalSales);
    const maxVal = Math.max(...allVals, 1);

    const xScale = (i: number) => PAD.l + (i / Math.max(periods.length - 1, 1)) * (W - PAD.l - PAD.r);
    const yScale = (v: number) => PAD.t + (1 - v / maxVal) * (H - PAD.t - PAD.b);

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
                {/* 격자 */}
                {[0.25, 0.5, 0.75, 1].map(r => (
                    <line key={r} x1={PAD.l} x2={W - PAD.r} y1={yScale(maxVal * r)} y2={yScale(maxVal * r)}
                        stroke="#f1f5f9" strokeWidth="1" />
                ))}
                {/* Y축 레이블 */}
                {[0, 0.5, 1].map(r => (
                    <text key={r} x={PAD.l - 6} y={yScale(maxVal * r) + 4} textAnchor="end"
                        fontSize="10" fill="#94a3b8">{formatKRWShort(maxVal * r)}</text>
                ))}
                {/* X축 레이블 */}
                {periods.filter((_, i) => i % Math.max(1, Math.floor(periods.length / 6)) === 0).map((p, i) => {
                    const idx = periods.indexOf(p);
                    return (
                        <text key={p} x={xScale(idx)} y={H - 6} textAnchor="middle"
                            fontSize="9" fill="#94a3b8">
                            {groupBy === 'monthly' ? p.slice(5) : p.slice(-3)}
                        </text>
                    );
                })}
                {/* 플랫폼별 라인 */}
                {platforms.map(platform => {
                    const pts = periods.map((p, i) => ({ x: xScale(i), y: yScale(byPlatform[platform]?.[p] || 0) }));
                    const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
                    const color = PLATFORM_COLORS[platform] || '#94a3b8';
                    return (
                        <g key={platform}>
                            <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                            {pts.map((pt, i) => (
                                <circle key={i} cx={pt.x} cy={pt.y} r="3" fill={color} />
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ─── 메인 컴포넌트 ───
export default function AnalyticsDashboardClient({ goals, thisYear, thisMonth, lastYear }: {
    goals: Goal[]; thisYear: number; thisMonth: number; lastYear: number;
}) {
    const [groupBy, setGroupBy] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
    const [salesData, setSalesData] = useState<SalesRow[]>([]);
    const [platforms, setPlatforms] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [rankMode, setRankMode] = useState<RankMode>('sales');
    const [editGoals, setEditGoals] = useState<Goal[]>(goals);
    const [isSavingGoals, setIsSavingGoals] = useState(false);

    // 매출 데이터 로드
    const loadSales = useCallback(async (gb: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sales/analysis?groupBy=${gb}`);
            const data = await res.json();
            if (data.success) {
                setSalesData(data.data || []);
                setPlatforms(data.platforms || []);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadSales(groupBy); }, [groupBy, loadSales]);

    // ─ 이번달 / 작년 동월 계산 ─
    const thisMonthStr = `${thisYear}-${String(thisMonth).padStart(2, '0')}`;
    const lastYearMonthStr = `${lastYear}-${String(thisMonth).padStart(2, '0')}`;
    const thisMonthSales = salesData.filter(r => r.period === thisMonthStr).reduce((s, r) => s + r.totalSales, 0);
    const lastMonthSales = salesData.filter(r => r.period === lastYearMonthStr).reduce((s, r) => s + r.totalSales, 0);
    const yoyPct = lastMonthSales > 0 ? ((thisMonthSales - lastMonthSales) / lastMonthSales * 100) : 0;
    const gaugeW = lastMonthSales > 0 ? Math.min((thisMonthSales / lastMonthSales) * 100, 100) : 0;

    // ─ 연간 전체 매출 ─
    const yearlyTotal = salesData.filter(r => r.period.startsWith(String(thisYear))).reduce((s, r) => s + r.totalSales, 0);
    const totalGoal = editGoals.find(g => g.platform === '전체')?.goal_amount || 1;
    const totalAchievePct = Math.min((yearlyTotal / totalGoal) * 100, 100);

    // ─ KPI 계산 ─
    const totalOrders = salesData.reduce((s, r) => s + r.orderCount, 0);
    const totalSalesAll = salesData.reduce((s, r) => s + r.totalSales, 0);
    const aovByOrder = totalOrders > 0 ? totalSalesAll / totalOrders : 0;

    // ─ TOP 5 랭킹 ─
    const productMap: Record<string, { sales: number; qty: number; profit: number }> = {};
    // NOTE: 현재 데이터는 플랫폼별로 집계되므로 데모용으로 플랫폼 기준 랭킹 표시
    for (const row of salesData) {
        if (!productMap[row.platform]) productMap[row.platform] = { sales: 0, qty: 0, profit: 0 };
        productMap[row.platform].sales += row.totalSales;
        productMap[row.platform].qty += row.quantity;
        productMap[row.platform].profit += row.totalProfit;
    }
    const ranking = Object.entries(productMap)
        .map(([name, v]) => ({ name, ...v, profitRate: v.sales > 0 ? v.profit / v.sales * 100 : 0 }))
        .sort((a, b) => rankMode === 'sales' ? b.sales - a.sales : rankMode === 'qty' ? b.qty - a.qty : b.profitRate - a.profitRate)
        .slice(0, 5);

    const handleSaveGoals = async () => {
        setIsSavingGoals(true);
        try {
            await fetch('/api/analytics/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goals: editGoals }),
            });
            alert('목표가 저장되었습니다!');
        } catch { alert('오류 발생'); }
        finally { setIsSavingGoals(false); }
    };

    return (
        <div className="space-y-6">
            {/* ─── 블록 1: 라인 그래프 ─── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-slate-800">📈 플랫폼별 매출 추세</h2>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        {(['daily', 'monthly', 'yearly'] as const).map(gb => (
                            <button key={gb} onClick={() => setGroupBy(gb)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === gb ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {{ daily: '일간', monthly: '월간', yearly: '연간' }[gb]}
                            </button>
                        ))}
                    </div>
                </div>
                {/* 범례 */}
                <div className="flex gap-4 flex-wrap mb-4">
                    {platforms.map(p => (
                        <div key={p} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: PLATFORM_COLORS[p] || '#94a3b8', height: 3 }}></div>
                            {p}
                        </div>
                    ))}
                </div>
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <LineSVGChart data={salesData} platforms={platforms} groupBy={groupBy} />
                )}
            </div>

            {/* ─── 블록 2: 전년 동월 비교 ─── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-slate-800 mb-5">📊 전년 동월 비교 ({thisMonth}월)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 숫자 병렬 */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl">
                            <div>
                                <p className="text-xs text-indigo-600 font-bold">이번달 ({thisYear}년 {thisMonth}월)</p>
                                <p className="text-2xl font-black text-indigo-700 mt-0.5">{formatKRW(thisMonthSales)}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                            <div>
                                <p className="text-xs text-slate-500 font-bold">작년 동월 ({lastYear}년 {thisMonth}월)</p>
                                <p className="text-2xl font-black text-slate-600 mt-0.5">{formatKRW(lastMonthSales)}</p>
                            </div>
                        </div>
                        <div className={`flex items-center justify-between p-4 rounded-xl ${yoyPct >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <p className={`text-sm font-bold ${yoyPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {yoyPct >= 0 ? '▲' : '▼'} 전년 대비 {Math.abs(yoyPct).toFixed(1)}%
                            </p>
                            <p className={`text-lg font-black ${yoyPct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {yoyPct >= 0 ? '+' : ''}{formatKRW(thisMonthSales - lastMonthSales)}
                            </p>
                        </div>
                    </div>
                    {/* 게이지 바 */}
                    <div className="flex flex-col justify-center space-y-3">
                        <p className="text-xs text-slate-500 font-bold">작년 대비 달성률</p>
                        <div className="relative">
                            <div className="h-8 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${gaugeW >= 100 ? 'bg-emerald-500' : gaugeW >= 70 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                                    style={{ width: `${gaugeW}%` }}>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-700 mt-2 text-center">{gaugeW.toFixed(1)}% 달성</p>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>0%</span>
                            <span>작년 동월 (100%)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── 블록 3: 연간 목표 트래킹 + KPI ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 목표 트래킹 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-base font-bold text-slate-800">🎯 {thisYear}년 매출 목표</h2>
                        <button onClick={handleSaveGoals} disabled={isSavingGoals}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400">
                            {isSavingGoals ? '저장 중...' : '목표 저장'}
                        </button>
                    </div>
                    {/* 전체 합산 게이지 */}
                    <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-700">전체 합산</span>
                            <span className="text-sm font-bold text-indigo-600">{totalAchievePct.toFixed(1)}%</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                                style={{ width: `${totalAchievePct}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>{formatKRWShort(yearlyTotal)}</span>
                            <span>목표: {formatKRWShort(totalGoal)}</span>
                        </div>
                    </div>
                    {/* 플랫폼별 목표 편집 */}
                    <div className="space-y-3">
                        {editGoals.filter(g => g.platform !== '전체').map((g, i) => {
                            const platformSales = salesData.filter(r => r.platform === g.platform && r.period.startsWith(String(thisYear))).reduce((s, r) => s + r.totalSales, 0);
                            const pct = g.goal_amount > 0 ? Math.min((platformSales / g.goal_amount) * 100, 100) : 0;
                            return (
                                <div key={g.id || i}>
                                    <div className="flex items-center justify-between mb-1 gap-2">
                                        <span className="text-xs font-semibold text-slate-600 w-16 flex-shrink-0">{g.platform}</span>
                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, backgroundColor: PLATFORM_COLORS[g.platform] || '#6366f1' }}></div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <input type="number"
                                                value={g.goal_amount}
                                                onChange={e => setEditGoals(prev => prev.map((eg, ei) => ei === i + 1 ? { ...eg, goal_amount: Number(e.target.value) } : eg))}
                                                className="w-24 text-right text-xs border border-slate-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                                                step={1000000}
                                            />
                                            <span className="text-xs text-slate-400">원</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* KPI */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-800 mb-5">💡 KPI 지표</h2>
                    <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-600 mb-1">객단가 (주문 건수 기준)</p>
                            <p className="text-2xl font-black text-slate-800">{formatKRW(Math.round(aovByOrder))}</p>
                            <p className="text-xs text-slate-400 mt-1">총 매출 ÷ 총 주문 {totalOrders.toLocaleString()}건</p>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-600 mb-1">이익률 (전체)</p>
                            <p className="text-2xl font-black text-slate-800">
                                {totalSalesAll > 0 ? ((salesData.reduce((s, r) => s + r.totalProfit, 0) / totalSalesAll) * 100).toFixed(1) : 0}%
                            </p>
                            <p className="text-xs text-slate-400 mt-1">이익 ÷ 매출</p>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                            <p className="text-xs font-bold text-amber-600 mb-1">누적 주문 수</p>
                            <p className="text-2xl font-black text-slate-800">{totalOrders.toLocaleString()}건</p>
                            <p className="text-xs text-slate-400 mt-1">{platforms.length}개 플랫폼 합산</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── 블록 4: TOP 5 랭킹 ─── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-slate-800">🏆 플랫폼별 랭킹</h2>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        {([['sales', '총매출'], ['qty', '판매수량'], ['profit', '이익률']] as const).map(([mode, label]) => (
                            <button key={mode} onClick={() => setRankMode(mode)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${rankMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    {ranking.map((item, idx) => {
                        const maxVal = ranking[0]?.[rankMode === 'profit' ? 'profitRate' : rankMode === 'qty' ? 'qty' : 'sales'] || 1;
                        const curVal = rankMode === 'profit' ? item.profitRate : rankMode === 'qty' ? item.qty : item.sales;
                        const pct = (curVal / maxVal) * 100;
                        const color = PLATFORM_COLORS[item.name] || '#6366f1';
                        return (
                            <div key={item.name} className="flex items-center gap-4">
                                <span className={`w-6 text-center text-sm font-black ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-500' : idx === 2 ? 'text-orange-400' : 'text-slate-400'}`}>
                                    {idx + 1}
                                </span>
                                <span className="w-16 text-sm font-semibold text-slate-700 flex-shrink-0">{item.name}</span>
                                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, backgroundColor: color }}></div>
                                </div>
                                <span className="text-sm font-bold text-slate-700 w-24 text-right flex-shrink-0">
                                    {rankMode === 'profit' ? `${item.profitRate.toFixed(1)}%` :
                                        rankMode === 'qty' ? `${item.qty.toLocaleString()}개` :
                                            formatKRWShort(item.sales)}
                                </span>
                            </div>
                        );
                    })}
                    {ranking.length === 0 && <p className="text-center text-slate-400 py-6">데이터 없음</p>}
                </div>
            </div>
        </div>
    );
}
