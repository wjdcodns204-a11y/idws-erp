'use client';

import { useState, useMemo } from 'react';

type Revenue = {
    year_month: string; platform: string;
    gross_sales: number; returns_amount: number; net_sales: number; platform_fee: number;
};
type Expense = { year_month: string; category: string; amount: number };
type CsRequest = { platform: string; request_type: string; status: string; created_at: string };

type Tab = 'channel' | 'monthly' | 'expense' | 'cs';

function formatKRW(v: number): string {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`;
    if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString()}만`;
    return `${sign}${abs.toLocaleString()}원`;
}

const PLATFORM_COLORS: Record<string, string> = {
    '무신사': 'bg-black text-white',
    '29CM': 'bg-amber-500 text-white',
    'W컨셉': 'bg-pink-500 text-white',
    '에이블리': 'bg-violet-500 text-white',
    '카페24': 'bg-orange-500 text-white',
    '자사몰': 'bg-indigo-500 text-white',
    '기타': 'bg-slate-400 text-white',
};

export default function AnalyticsClient({
    initialRevenues, initialExpenses, initialCsRequests, months,
}: {
    initialRevenues: Revenue[];
    initialExpenses: Expense[];
    initialCsRequests: CsRequest[];
    months: string[];
}) {
    const [tab, setTab] = useState<Tab>('channel');

    // ① 채널별 수익성
    const channelStats = useMemo(() => {
        const map = new Map<string, { grossSales: number; returns: number; fees: number; netRevenue: number }>();
        for (const r of initialRevenues) {
            const e = map.get(r.platform) || { grossSales: 0, returns: 0, fees: 0, netRevenue: 0 };
            e.grossSales += r.gross_sales || 0;
            e.returns += r.returns_amount || 0;
            e.fees += r.platform_fee || 0;
            e.netRevenue += (r.net_sales || 0) - (r.platform_fee || 0);
            map.set(r.platform, e);
        }
        return Array.from(map.entries()).map(([platform, d]) => ({
            platform,
            ...d,
            returnRate: d.grossSales > 0 ? Math.round((d.returns / d.grossSales) * 100) : 0,
            profitMargin: d.grossSales > 0 ? Math.round((d.netRevenue / d.grossSales) * 100) : 0,
        })).sort((a, b) => b.netRevenue - a.netRevenue);
    }, [initialRevenues]);

    // ② 월별 추이
    const monthlyTrend = useMemo(() => {
        return months.map(m => {
            const revs = initialRevenues.filter(r => r.year_month === m);
            const exps = initialExpenses.filter(e => e.year_month === m);
            const gross = revs.reduce((s, r) => s + (r.gross_sales || 0), 0);
            const net = revs.reduce((s, r) => s + (r.net_sales || 0), 0);
            const fees = revs.reduce((s, r) => s + (r.platform_fee || 0), 0);
            const totalExp = exps.reduce((s, e) => s + (e.amount || 0), 0);
            const profit = net - fees - totalExp;
            return { month: m, gross, net, fees, totalExp, profit, margin: net > 0 ? Math.round((profit / net) * 100) : 0 };
        });
    }, [initialRevenues, initialExpenses, months]);

    // ③ 비용 카테고리별
    const expenseBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of initialExpenses) {
            map.set(e.category, (map.get(e.category) || 0) + e.amount);
        }
        const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
        return Array.from(map.entries())
            .map(([category, amount]) => ({ category, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }))
            .sort((a, b) => b.amount - a.amount);
    }, [initialExpenses]);

    // ④ CS/반품 플랫폼별
    const csStats = useMemo(() => {
        const map = new Map<string, { total: number; returns: number; exchanges: number; completed: number }>();
        for (const cs of initialCsRequests) {
            const e = map.get(cs.platform) || { total: 0, returns: 0, exchanges: 0, completed: 0 };
            e.total++;
            if (cs.request_type === '반품') e.returns++;
            if (cs.request_type === '교환') e.exchanges++;
            if (cs.status === '완료') e.completed++;
            map.set(cs.platform, e);
        }
        return Array.from(map.entries()).map(([platform, d]) => ({
            platform, ...d,
            completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        })).sort((a, b) => b.total - a.total);
    }, [initialCsRequests]);

    // 전체 요약
    const totalGross = initialRevenues.reduce((s, r) => s + (r.gross_sales || 0), 0);
    const totalNet = initialRevenues.reduce((s, r) => s + (r.net_sales || 0), 0);
    const totalFees = initialRevenues.reduce((s, r) => s + (r.platform_fee || 0), 0);
    const totalExp = initialExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalProfit = totalNet - totalFees - totalExp;
    const overallMargin = totalNet > 0 ? Math.round((totalProfit / totalNet) * 100) : 0;
    const maxGross = Math.max(...channelStats.map(c => c.grossSales), 1);
    const maxMonthly = Math.max(...monthlyTrend.map(m => m.gross), 1);

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">분석·리포팅</h1>
                <p className="text-sm text-slate-500 mt-1">채널별 수익성, 월별 추이, 비용 구조, CS 현황을 한눈에 파악합니다.</p>
            </div>

            {/* 전체 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: '총 매출 (최근 6개월)', value: formatKRW(totalGross), color: 'text-slate-800' },
                    { label: '수수료 차감 순매출', value: formatKRW(totalNet - totalFees), color: 'text-indigo-700' },
                    { label: `영업이익 (마진 ${overallMargin}%)`, value: formatKRW(totalProfit), color: totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
                    { label: 'CS 건수', value: `${initialCsRequests.length}건`, color: 'text-amber-700' },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                        <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                        <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* 탭 */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
                {([
                    ['channel', '📊 채널별 수익성'],
                    ['monthly', '📈 월별 추이'],
                    ['expense', '💸 비용 구조'],
                    ['cs', '🔄 CS·반품'],
                ] as [Tab, string][]).map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── 채널별 수익성 탭 ── */}
            {tab === 'channel' && (
                <div className="space-y-4">
                    {channelStats.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">
                            재무 → 재무 관리에서 매출 데이터를 먼저 입력해주세요
                        </div>
                    ) : (
                        <>
                            {/* 막대 차트 */}
                            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                                <h3 className="text-sm font-bold text-slate-800 mb-4">플랫폼별 총매출 비교</h3>
                                <div className="space-y-3">
                                    {channelStats.map(c => (
                                        <div key={c.platform} className="flex items-center gap-3">
                                            <div className="w-16 text-xs font-semibold text-right text-slate-600">{c.platform}</div>
                                            <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full flex items-center px-2 transition-all duration-700 ${PLATFORM_COLORS[c.platform] || 'bg-slate-500 text-white'}`}
                                                    style={{ width: `${Math.max(2, (c.grossSales / maxGross) * 100)}%` }}>
                                                    <span className="text-xs font-bold truncate">{formatKRW(c.grossSales)}</span>
                                                </div>
                                            </div>
                                            <div className={`w-12 text-xs font-bold text-right ${c.profitMargin >= 20 ? 'text-emerald-600' : c.profitMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                {c.profitMargin}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 채널별 상세 테이블 */}
                            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                        <tr>
                                            <th className="px-4 py-3 text-left">플랫폼</th>
                                            <th className="px-4 py-3 text-right">총매출</th>
                                            <th className="px-4 py-3 text-right">반품</th>
                                            <th className="px-4 py-3 text-right">반품율</th>
                                            <th className="px-4 py-3 text-right">수수료</th>
                                            <th className="px-4 py-3 text-right">실수익</th>
                                            <th className="px-4 py-3 text-right">마진율</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {channelStats.map(c => (
                                            <tr key={c.platform} className="border-b border-slate-50">
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[c.platform] || 'bg-slate-100 text-slate-600'}`}>
                                                        {c.platform}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatKRW(c.grossSales)}</td>
                                                <td className="px-4 py-3 text-right text-red-500">-{formatKRW(c.returns)}</td>
                                                <td className={`px-4 py-3 text-right font-semibold ${c.returnRate > 10 ? 'text-red-600' : c.returnRate > 5 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                    {c.returnRate}%
                                                </td>
                                                <td className="px-4 py-3 text-right text-orange-500">-{formatKRW(c.fees)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatKRW(c.netRevenue)}</td>
                                                <td className={`px-4 py-3 text-right font-bold ${c.profitMargin >= 20 ? 'text-emerald-700' : c.profitMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {c.profitMargin}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── 월별 추이 탭 ── */}
            {tab === 'monthly' && (
                <div className="space-y-4">
                    {/* 막대 차트 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">월별 매출·이익 추이 (최근 6개월)</h3>
                        <div className="space-y-4">
                            {monthlyTrend.map(m => (
                                <div key={m.month} className="space-y-1.5">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span className="font-semibold text-slate-700">{m.month}</span>
                                        <span className={`font-bold ${m.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>마진 {m.margin}%</span>
                                    </div>
                                    <div className="flex gap-1 h-5">
                                        <div className="bg-indigo-200 rounded-sm overflow-hidden" style={{ width: `${(m.gross / maxMonthly) * 70}%`, minWidth: '2px' }}>
                                            <div className="bg-indigo-500 h-full" style={{ width: `${m.gross > 0 ? 100 : 0}%` }} />
                                        </div>
                                        <div className="bg-emerald-200 rounded-sm overflow-hidden" style={{ width: `${(Math.max(0, m.profit) / maxMonthly) * 70}%`, minWidth: '2px' }}>
                                            <div className="bg-emerald-500 h-full" />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                        <span>매출 {formatKRW(m.gross)}</span>
                                        <span>순이익 {formatKRW(m.profit)}</span>
                                        <span>비용 {formatKRW(m.totalExp)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4 mt-4 text-xs">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-indigo-500" /><span className="text-slate-500">총매출</span></div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-slate-500">영업이익</span></div>
                        </div>
                    </div>

                    {/* 월별 표 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">월</th>
                                    <th className="px-4 py-3 text-right">총매출</th>
                                    <th className="px-4 py-3 text-right">수수료</th>
                                    <th className="px-4 py-3 text-right">총비용</th>
                                    <th className="px-4 py-3 text-right">영업이익</th>
                                    <th className="px-4 py-3 text-right">마진율</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyTrend.map(m => (
                                    <tr key={m.month} className="border-b border-slate-50">
                                        <td className="px-4 py-3 font-semibold text-slate-700">{m.month}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatKRW(m.gross)}</td>
                                        <td className="px-4 py-3 text-right text-orange-500">{formatKRW(m.fees)}</td>
                                        <td className="px-4 py-3 text-right text-red-500">{formatKRW(m.totalExp)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${m.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatKRW(m.profit)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${m.margin >= 20 ? 'text-emerald-700' : m.margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{m.margin}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── 비용 구조 탭 ── */}
            {tab === 'expense' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">비용 구조 분석 (최근 6개월)</h3>
                        {expenseBreakdown.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">재무 관리에서 비용을 먼저 입력해주세요</p>
                        ) : (
                            <div className="space-y-3">
                                {expenseBreakdown.map(e => (
                                    <div key={e.category}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-slate-700">{e.category}</span>
                                            <span className="text-slate-500">{formatKRW(e.amount)} ({e.pct}%)</span>
                                        </div>
                                        <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                                            <div className="bg-gradient-to-r from-rose-500 to-orange-400 h-full rounded-full transition-all duration-700"
                                                style={{ width: `${e.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-bold">
                                    <span className="text-slate-700">총 비용</span>
                                    <span className="text-rose-700">{formatKRW(expenseBreakdown.reduce((s, e) => s + e.amount, 0))}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── CS·반품 탭 ── */}
            {tab === 'cs' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-slate-800 mb-1">전체 CS 현황</h3>
                            <p className="text-xs text-slate-400 mb-4">최근 6개월 기준</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: '총 CS', value: initialCsRequests.length, color: 'text-slate-800' },
                                    { label: '반품', value: initialCsRequests.filter(c => c.request_type === '반품').length, color: 'text-red-600' },
                                    { label: '교환', value: initialCsRequests.filter(c => c.request_type === '교환').length, color: 'text-purple-600' },
                                    { label: '처리 완료', value: initialCsRequests.filter(c => c.status === '완료').length, color: 'text-emerald-600' },
                                ].map(s => (
                                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                        <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">플랫폼별 CS 현황</h3>
                            {csStats.length === 0 ? (
                                <p className="text-center text-slate-400 py-4">CS 데이터가 없습니다</p>
                            ) : (
                                <div className="space-y-2">
                                    {csStats.map(c => (
                                        <div key={c.platform} className="flex items-center justify-between text-sm">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[c.platform] || 'bg-slate-100 text-slate-600'}`}>
                                                {c.platform}
                                            </span>
                                            <div className="flex gap-3 text-xs text-slate-500">
                                                <span className="text-red-500">반품 {c.returns}</span>
                                                <span className="text-purple-500">교환 {c.exchanges}</span>
                                                <span className={`font-semibold ${c.completionRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>완료 {c.completionRate}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
