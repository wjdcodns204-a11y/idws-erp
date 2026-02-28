'use client';
// 매출 분석 페이지 — 이지어드민 CSV 데이터 기반 플랫폼별 매출
// 일간/주간/월간/연간 필터링

import { useState, useEffect, useCallback } from 'react';

// 원화 포맷 — 전체 숫자 표시 (쉼표 구분)
function formatKRW(value: number): string {
    return value.toLocaleString() + '원';
}

// 기간 레이블 포맷
function formatPeriod(period: string, groupBy: string): string {
    if (groupBy === 'daily') return period; // YYYY-MM-DD
    if (groupBy === 'weekly') return period; // YYYY-Wxx
    if (groupBy === 'monthly') {
        const [y, m] = period.split('-');
        return `${y}년 ${parseInt(m)}월`;
    }
    if (groupBy === 'yearly') return `${period}년`;
    return period;
}

// 플랫폼별 색상
const PLATFORM_COLORS: Record<string, string> = {
    '무신사': '#1a1a2e',
    '29CM': '#ff6b35',
    'EQL': '#4a90d9',
    '카페24': '#00c73c',
    'Cafe24': '#00c73c',
    '하이버': '#ff4081',
    '지그재그': '#ff6584',
    'W컨셉': '#333333',
    '에이블리': '#ff7eb3',
    '기타': '#999999',
};

interface SalesRow {
    period: string;
    platform: string;
    orderCount: number;
    quantity: number;
    totalSales: number;
    totalRegular: number;
    totalCost: number;
    totalProfit: number;
}

interface SalesData {
    success: boolean;
    groupBy: string;
    platforms: string[];
    summary: { totalSales: number; totalCost: number; totalProfit: number; totalOrders: number };
    data: SalesRow[];
    error?: string;
}

type GroupBy = 'daily' | 'weekly' | 'monthly' | 'yearly';

// 무신사 매출 요약 타입
interface SettlementData {
    channelName: string;
    periodStart: string;
    periodEnd: string;
    totalSales: number;
    totalCost: number;
    totalProfit: number;
    orderCount: number;
    channelBreakdown?: Record<string, { sales: number; cost: number; profit: number; orders: number }>;
}

export default function SalesPage() {
    const [groupBy, setGroupBy] = useState<GroupBy>('monthly');
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 무신사 정산 관련 상태
    const [settlement, setSettlement] = useState<SettlementData | null>(null);
    const [settlementLoading, setSettlementLoading] = useState(false);
    const [settlementError, setSettlementError] = useState('');

    const fetchData = useCallback(async (gb: GroupBy) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/sales/analysis?groupBy=${gb}`);
            const result = await res.json();
            if (result.success) {
                setData(result);
            } else {
                setError(result.error || '데이터 로드 실패');
            }
        } catch {
            setError('서버 연결 실패');
        } finally {
            setLoading(false);
        }
    }, []);

    // 무신사 정산 데이터 조회
    const fetchSettlement = useCallback(async () => {
        setSettlementLoading(true);
        setSettlementError('');
        try {
            const res = await fetch('/api/musinsa/settlements');
            const result = await res.json();
            if (result.success) {
                setSettlement(result.data);
            } else {
                setSettlementError(result.error || '무신사 정산 조회 실패');
            }
        } catch {
            setSettlementError('무신사 API 연결 실패');
        } finally {
            setSettlementLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(groupBy); }, [groupBy, fetchData]);
    useEffect(() => { fetchSettlement(); }, [fetchSettlement]);

    // 기간별로 그룹핑 (피벗 테이블 형태)
    const pivotData = (() => {
        if (!data?.data) return [];
        const periodMap = new Map<string, Record<string, SalesRow>>();
        for (const row of data.data) {
            if (!periodMap.has(row.period)) periodMap.set(row.period, {});
            periodMap.get(row.period)![row.platform] = row;
        }
        return Array.from(periodMap.entries())
            .map(([period, platforms]) => ({ period, platforms }))
            .sort((a, b) => b.period.localeCompare(a.period));
    })();

    // 각 기간의 총 합
    const periodTotals = pivotData.map(({ period, platforms }) => {
        const rows = Object.values(platforms);
        return {
            period,
            totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
            totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
            totalProfit: rows.reduce((s, r) => s + r.totalProfit, 0),
            totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
            totalQty: rows.reduce((s, r) => s + r.quantity, 0),
        };
    });

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e' }}>📊 매출 분석</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['daily', 'weekly', 'monthly', 'yearly'] as GroupBy[]).map(gb => (
                        <button key={gb} onClick={() => setGroupBy(gb)}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                                fontWeight: groupBy === gb ? 700 : 400, fontSize: '0.9rem',
                                background: groupBy === gb ? '#1a1a2e' : '#f0f0f5',
                                color: groupBy === gb ? '#fff' : '#555',
                                transition: 'all 0.2s',
                            }}>
                            {{ daily: '일간', weekly: '주간', monthly: '월간', yearly: '연간' }[gb]}
                        </button>
                    ))}
                </div>
            </div>

            {/* 로딩 / 에러 */}
            {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>📊 데이터 로딩 중...</div>}
            {error && <div style={{ textAlign: 'center', padding: '2rem', color: '#e74c3c', background: '#fff5f5', borderRadius: 12 }}>{error}</div>}

            {data && !loading && (
                <>
                    {/* 요약 카드 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        <SummaryCard label="총 매출" value={formatKRW(data.summary.totalSales)} sub="결제금액 기준" color="#2563eb" />
                        <SummaryCard label="총 원가" value={formatKRW(data.summary.totalCost)} sub="공급가 기준" color="#dc2626" />
                        <SummaryCard label="총 이익" value={formatKRW(data.summary.totalProfit)} sub="매출 - 원가" color="#059669" />
                        <SummaryCard label="총 주문수" value={data.summary.totalOrders.toLocaleString() + '건'} sub={`${data.platforms.length}개 플랫폼`} color="#7c3aed" />
                    </div>

                    {/* ─── 무신사 정산 섹션 ─── */}
                    <div style={{
                        background: '#fff', borderRadius: 16, padding: '1.25rem 1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '2rem',
                        borderLeft: '4px solid #1a1a2e',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                                🏬 무신사 정산 현황
                            </h2>
                            <button onClick={fetchSettlement} disabled={settlementLoading}
                                style={{
                                    padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #ddd',
                                    background: settlementLoading ? '#f0f0f0' : '#fff', cursor: 'pointer',
                                    fontSize: '0.8rem', color: '#666',
                                }}>
                                {settlementLoading ? '조회 중...' : '🔄 새로고침'}
                            </button>
                        </div>

                        {settlementError && (
                            <div style={{
                                padding: '0.75rem 1rem', background: '#fff5f5', borderRadius: 8,
                                color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.5rem',
                            }}>
                                ⚠️ {settlementError}
                            </div>
                        )}

                        {settlement && (
                            <>
                                <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '0.75rem' }}>
                                    기간: {settlement.periodStart} ~ {settlement.periodEnd}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>총 매출</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>
                                            {formatKRW(settlement.totalSales)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>원가</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>
                                            {formatKRW(settlement.totalCost)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>이익</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>
                                            {formatKRW(settlement.totalProfit)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>주문수</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#7c3aed' }}>
                                            {settlement.orderCount.toLocaleString()}건
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {!settlement && !settlementError && !settlementLoading && (
                            <div style={{ color: '#aaa', fontSize: '0.85rem' }}>정산 데이터 없음</div>
                        )}
                    </div>

                    {/* 플랫폼 범례 */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        {data.platforms.map(p => (
                            <span key={p} style={{
                                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#666',
                            }}>
                                <span style={{
                                    width: 12, height: 12, borderRadius: 3,
                                    background: PLATFORM_COLORS[p] || '#999',
                                }} />
                                {p}
                            </span>
                        ))}
                    </div>

                    {/* 매출 테이블 */}
                    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                                    <th style={{ ...thStyle, minWidth: 100 }}>기간</th>
                                    <th style={{ ...thStyle, minWidth: 80 }}>주문수</th>
                                    <th style={thStyle}>총 매출</th>
                                    {data.platforms.map(p => (
                                        <th key={p} style={{ ...thStyle, borderLeft: '1px solid #e9ecef' }}>
                                            <span style={{
                                                display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                                                background: PLATFORM_COLORS[p] || '#999', marginRight: 4,
                                            }} />
                                            {p}
                                        </th>
                                    ))}
                                    <th style={thStyle}>이익</th>
                                    <th style={thStyle}>이익률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pivotData.map(({ period, platforms: platData }, idx) => {
                                    const totals = periodTotals[idx];
                                    const profitRate = totals.totalSales > 0 ? (totals.totalProfit / totals.totalSales * 100) : 0;
                                    return (
                                        <tr key={period} style={{
                                            borderBottom: '1px solid #f0f0f0',
                                            background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                                        }}>
                                            <td style={{ ...tdStyle, fontWeight: 600 }}>{formatPeriod(period, groupBy)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>{totals.totalOrders.toLocaleString()}</td>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: '#2563eb' }}>
                                                {formatKRW(totals.totalSales)}
                                            </td>
                                            {data.platforms.map(p => {
                                                const row = platData[p];
                                                return (
                                                    <td key={p} style={{ ...tdStyle, textAlign: 'right', borderLeft: '1px solid #f0f0f0' }}>
                                                        {row ? (
                                                            <div>
                                                                <div style={{ fontWeight: 500 }}>{formatKRW(row.totalSales)}</div>
                                                                <div style={{ fontSize: '0.7rem', color: '#999' }}>{row.orderCount}건</div>
                                                            </div>
                                                        ) : <span style={{ color: '#ccc' }}>-</span>}
                                                    </td>
                                                );
                                            })}
                                            <td style={{
                                                ...tdStyle, fontWeight: 600,
                                                color: totals.totalProfit >= 0 ? '#059669' : '#dc2626',
                                            }}>
                                                {formatKRW(totals.totalProfit)}
                                            </td>
                                            <td style={{
                                                ...tdStyle, textAlign: 'center',
                                                color: profitRate >= 30 ? '#059669' : profitRate >= 15 ? '#d97706' : '#dc2626',
                                            }}>
                                                {profitRate.toFixed(1)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

// 요약 카드 컴포넌트
function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 16, padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}`,
        }}>
            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 2 }}>{sub}</div>
        </div>
    );
}

// 스타일 상수
const thStyle: React.CSSProperties = {
    padding: '0.75rem 0.6rem', textAlign: 'right', fontWeight: 600,
    fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
    padding: '0.6rem', textAlign: 'right', whiteSpace: 'nowrap',
};
