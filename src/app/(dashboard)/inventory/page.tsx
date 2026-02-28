// 재고 현황 페이지 — musinsa-products.json + 판매 통계 기반
// 시즌별 재고, 안전재고 경고, ABC 등급 분류 (실제 데이터)

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

// ─── 타입 ───

interface SizeStockItem {
    size: string;
    stock: number;
    defective: number;
    available: number;
}

interface Product {
    musinsaCode: string;
    name: string;
    styleCode: string;
    categoryM: string;
    status: string;
    tagPrice: number;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    availableStock: number;
    store: string;
    sizeStock?: SizeStockItem[];
}

interface SalesStats {
    totalQty: number;
    weeklyAvg: number;
    orderCount: number;
    totalAmount: number;
    firstDate: string;
    lastDate: string;
}

// ─── 유틸 ───

// 원화 포맷 — 전체 숫자 표시 (쉼표 구분)
function formatKRW(value: number): string {
    return value.toLocaleString() + '원';
}

// 시즌 추출 (상품관리 페이지와 동일)
function extractSeason(code: string): string {
    if (code.startsWith('I')) {
        const yr = code.substring(1, 3);
        const sn = code.substring(3, 5);
        return `${yr}${sn}`;
    }
    if (code.startsWith('23F')) return '23FW';
    if (code.startsWith('QIDW')) return 'Legacy';
    if (code.startsWith('Z')) return 'Z-기타';
    return '기타';
}

// ABC 등급 판정 (주간 평균 판매량 기준)
function getGrade(weeklyAvg: number): string {
    if (weeklyAvg >= 15) return 'A';
    if (weeklyAvg >= 5) return 'B';
    if (weeklyAvg >= 1) return 'C';
    return 'F';
}

const GRADE_COLORS: Record<string, string> = {
    A: 'bg-emerald-50 text-emerald-600',
    B: 'bg-blue-50 text-blue-600',
    C: 'bg-amber-50 text-amber-600',
    F: 'bg-red-50 text-red-600',
};

// ─── 메인 ───

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [salesStats, setSalesStats] = useState<Record<string, SalesStats>>({});
    const [loading, setLoading] = useState(true);
    const [skuSearch, setSkuSearch] = useState('');

    // 데이터 로드
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [prodRes, statsRes] = await Promise.all([
                fetch('/data/musinsa-products.json?t=' + Date.now()),
                fetch('/api/products/sales-stats'),
            ]);
            const prodData: Product[] = await prodRes.json();
            setProducts(prodData.filter(p => p.status !== '삭제'));

            const statsData = await statsRes.json();
            if (statsData.success && statsData.stats) setSalesStats(statsData.stats);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── 시즌별 재고 집계 ───
    const seasonInventory = useMemo(() => {
        const map: Record<string, { qty: number; value: number }> = {};
        products.forEach(p => {
            const season = extractSeason(p.styleCode);
            if (!map[season]) map[season] = { qty: 0, value: 0 };
            map[season].qty += p.availableStock || 0;
            map[season].value += (p.availableStock || 0) * (p.costPrice || 0);
        });
        const totalValue = Object.values(map).reduce((s, v) => s + v.value, 0);
        return Object.entries(map)
            .map(([season, d]) => ({
                season,
                qty: d.qty,
                value: d.value,
                percent: totalValue > 0 ? Math.round((d.value / totalValue) * 1000) / 10 : 0,
            }))
            .sort((a, b) => {
                // 최근 시즌 먼저
                const order = (s: string) => {
                    const m = s.match(/^(\d{2})(SS|FW)$/);
                    if (m) return parseInt(m[1]) * 2 + (m[2] === 'FW' ? 1 : 0);
                    return -1;
                };
                return order(b.season) - order(a.season);
            });
    }, [products]);

    // ─── 총계 ───
    const totalQty = useMemo(() => products.reduce((s, p) => s + (p.availableStock || 0), 0), [products]);
    const totalAsset = useMemo(() => products.reduce((s, p) => s + (p.availableStock || 0) * (p.costPrice || 0), 0), [products]);

    // ─── 안전재고 경고 (재고 50개 이하 + 주간 판매 있는 상품) ───
    const lowStockItems = useMemo(() => {
        return products
            .map(p => {
                const stat = salesStats[p.name];
                const weeklyAvg = stat?.weeklyAvg || 0;
                const weeksLeft = weeklyAvg > 0 ? p.availableStock / weeklyAvg : 999;
                return {
                    code: p.styleCode,
                    name: p.name,
                    season: extractSeason(p.styleCode),
                    stock: p.availableStock,
                    weekAvg: weeklyAvg,
                    weeksLeft: Math.round(weeksLeft * 10) / 10,
                };
            })
            .filter(i => i.stock > 0 && i.stock <= 50 && i.weekAvg > 0)
            .sort((a, b) => a.weeksLeft - b.weeksLeft)
            .slice(0, 10);
    }, [products, salesStats]);

    // ─── ABC 등급 상품 ───
    const abcProducts = useMemo(() => {
        return products
            .map(p => {
                const stat = salesStats[p.name];
                if (!stat || stat.totalQty <= 0) return null;
                const weeklyAvg = stat.weeklyAvg;
                const grade = getGrade(weeklyAvg);
                // 판매율 = 총 판매 / (총 판매 + 현재 재고)
                const totalProduced = stat.totalQty + p.availableStock;
                const salesRate = totalProduced > 0 ? (stat.totalQty / totalProduced * 100) : 0;
                // 원가회수율 = 총 매출 / (총 생산량 × 원가)
                const totalCostInvested = totalProduced * (p.costPrice || 0);
                const costRecovery = totalCostInvested > 0 ? (stat.totalAmount / totalCostInvested * 100) : 0;
                return {
                    code: p.styleCode,
                    name: p.name,
                    grade,
                    stock: p.availableStock,
                    weekAvg: Math.round(weeklyAvg * 10) / 10,
                    salesRate: Math.round(salesRate * 10) / 10,
                    costRecovery: Math.round(costRecovery * 10) / 10,
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .sort((a, b) => b.weekAvg - a.weekAvg)
            .slice(0, 20);
    }, [products, salesStats]);

    // SKU 검색 필터
    const filteredABC = useMemo(() => {
        if (!skuSearch) return abcProducts;
        const q = skuSearch.toLowerCase();
        return abcProducts.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }, [abcProducts, skuSearch]);

    // 등급별 카운트
    const gradeCounts = useMemo(() => {
        const counts: Record<string, number> = { A: 0, B: 0, C: 0, F: 0 };
        products.forEach(p => {
            const stat = salesStats[p.name];
            if (stat && stat.totalQty > 0) {
                counts[getGrade(stat.weeklyAvg)]++;
            }
        });
        return counts;
    }, [products, salesStats]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>재고 현황</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                        musinsa-products.json 기준 · {products.length}개 상품
                    </p>
                </div>
                <button onClick={loadData}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    새로고침
                </button>
            </div>

            {/* ─── 요약 카드 ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>총 재고 자산 (원가)</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatKRW(totalAsset)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>총 재고 수량</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalQty.toLocaleString()}개</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>보유 시즌</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{seasonInventory.length}개</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {seasonInventory.length > 0 ? `${seasonInventory[seasonInventory.length - 1]?.season} ~ ${seasonInventory[0]?.season}` : '-'}
                    </p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>품절 위험</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--danger)' }}>{lowStockItems.filter(i => i.weeksLeft < 2).length}개</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>2주 이내 소진 예상</p>
                </div>
                <div className="rounded-xl p-4 hidden sm:block" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>A군 상품</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{gradeCounts.A}개</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>주 15개 이상 판매</p>
                </div>
            </div>

            {/* ─── 안전재고 경고 ─── */}
            {lowStockItems.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">⚠️</span>
                        <h3 className="text-sm font-semibold" style={{ color: '#991b1b' }}>안전재고 경고 — {lowStockItems.length}개 상품</h3>
                    </div>
                    <div className="space-y-2">
                        {lowStockItems.map(item => (
                            <div key={item.code + item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-white/80">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{item.code} · {item.season}</p>
                                </div>
                                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 ml-3">
                                    <div className="text-right">
                                        <p className={`text-xs font-bold ${item.stock < 20 ? 'text-red-600' : 'text-amber-600'}`}>{item.stock}개</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>주평균 {item.weekAvg.toFixed(1)}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium hidden sm:inline ${item.weeksLeft < 1 ? 'bg-red-100 text-red-700' : item.weeksLeft < 3 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {item.weeksLeft < 1 ? '긴급' : item.weeksLeft < 3 ? '주의' : '관찰'} · {item.weeksLeft}주
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── 시즌별 재고 분포 ─── */}
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>시즌별 재고 분포</h3>
                <div className="space-y-3">
                    {seasonInventory.map(s => (
                        <div key={s.season}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{s.season}</span>
                                <div className="flex items-center gap-3 text-xs">
                                    <span style={{ color: "var(--text-tertiary)" }}>{s.qty.toLocaleString()}개</span>
                                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatKRW(s.value)}</span>
                                </div>
                            </div>
                            <div className="w-full h-3 rounded-full" style={{ background: "var(--border-light)" }}>
                                <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                    style={{ width: `${Math.min(s.percent, 100)}%`, opacity: 0.5 + (s.percent / 100) * 0.5 }} />
                            </div>
                            <p className="text-[10px] text-right mt-0.5" style={{ color: "var(--text-tertiary)" }}>{s.percent}%</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── ABC 등급 상품 ─── */}
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>A/B/C/F군 상품</h3>
                        <div className="flex gap-1">
                            {(['A', 'B', 'C', 'F'] as const).map(g => (
                                <span key={g} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${GRADE_COLORS[g]}`}>
                                    {g}: {gradeCounts[g]}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text" placeholder="SKU 검색..."
                            value={skuSearch} onChange={e => setSkuSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs rounded-lg w-32 sm:w-40"
                            style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ background: "var(--background)", color: "var(--text-tertiary)" }}>
                                <th className="px-3 sm:px-4 py-3 text-center font-medium">등급</th>
                                <th className="px-3 sm:px-4 py-3 text-left font-medium hidden sm:table-cell">품번</th>
                                <th className="px-3 sm:px-4 py-3 text-left font-medium">상품명</th>
                                <th className="px-4 py-3 text-right font-medium">재고</th>
                                <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">주평균</th>
                                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">판매율</th>
                                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">원가회수율</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredABC.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-slate-400">
                                        {skuSearch ? '검색 결과가 없습니다' : '판매 데이터 없음'}
                                    </td>
                                </tr>
                            ) : (
                                filteredABC.map(p => (
                                    <tr key={p.code + p.name} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td className="px-3 sm:px-4 py-3 text-center">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${GRADE_COLORS[p.grade]}`}>{p.grade}군</span>
                                        </td>
                                        <td className="px-3 sm:px-4 py-3 font-mono hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>{p.code}</td>
                                        <td className="px-3 sm:px-4 py-3 font-medium truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                                        <td className="px-4 py-3 text-right" style={{ color: p.stock < 50 ? 'var(--danger)' : 'var(--text-primary)' }}>{p.stock.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-semibold hidden sm:table-cell" style={{ color: 'var(--text-primary)' }}>{p.weekAvg}</td>
                                        <td className="px-4 py-3 text-right hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>{p.salesRate}%</td>
                                        <td className="px-4 py-3 text-right font-semibold hidden md:table-cell" style={{ color: p.costRecovery >= 100 ? 'var(--success)' : 'var(--warning)' }}>{p.costRecovery}%</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
