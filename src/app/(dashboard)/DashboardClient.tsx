"use client";

import { useState } from "react";

// ─── 타입 정의 ───
interface InventorySummary {
    totalStock: number;
    totalAsset: number;
    productCount: number;
    seasons: { season: string; qty: number; value: number; percent: number }[];
    lowStockItems: { sku: string; name: string; stock: number; category: string }[];
}
interface CsSummary { todayCount: number; pendingCount: number; totalCount: number }
interface HrSummary { headCount: number }
interface Goals { monthlyGoal: number; annualGoal: number }

interface Props {
    inventorySummary: InventorySummary;
    csSummary: CsSummary;
    hrSummary: HrSummary;
    goals: Goals;
    updatedAt: string;
}

function formatKRW(v: number) {
    if (Math.abs(v) >= 100_000_000) return `₩${(v / 100_000_000).toFixed(1)}억`;
    if (Math.abs(v) >= 10_000) return `₩${Math.round(v / 10_000).toLocaleString()}만`;
    return `₩${v.toLocaleString()}`;
}

const SEASON_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e0e7ff", "#f1f5f9", "#cbd5e1"];

// ─── 메인 대시보드 클라이언트 컴포넌트 ───
export default function DashboardClient({ inventorySummary, csSummary, hrSummary, goals, updatedAt }: Props) {
    const [showLowStock, setShowLowStock] = useState(false);

    const updatedTime = new Date(updatedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const perCapita = hrSummary.headCount > 0
        ? Math.round(inventorySummary.totalAsset / hrSummary.headCount)
        : 0;

    return (
        <div className="space-y-6 animate-fade-in">

            {/* ─── 재고 부족 경고 배너 ─── */}
            {inventorySummary.lowStockItems.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-orange-500">⚠️</span>
                            <span className="text-sm font-semibold text-orange-800">
                                재고 부족 상품 {inventorySummary.lowStockItems.length}개 (20개 이하)
                            </span>
                        </div>
                        <button
                            onClick={() => setShowLowStock(!showLowStock)}
                            className="text-xs text-orange-600 hover:underline"
                        >
                            {showLowStock ? '숨기기' : '목록 보기'}
                        </button>
                    </div>
                    {showLowStock && (
                        <div className="mt-3 space-y-1">
                            {inventorySummary.lowStockItems.map(item => (
                                <div key={item.sku} className="flex justify-between text-xs text-orange-700 bg-orange-100 rounded px-3 py-1.5">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="font-bold text-orange-600">{item.stock}개 남음</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── 헤더 ─── */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>대시보드</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                        실시간 현황 · 마지막 갱신 {updatedTime}
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
                    style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    실시간 DB 연동
                </div>
            </div>

            {/* ─── 요약 카드 4개 ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* 총 재고 자산 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>총 재고 자산</span>
                        <span className="text-lg">📦</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{formatKRW(inventorySummary.totalAsset)}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{inventorySummary.totalStock.toLocaleString()}개 · {inventorySummary.productCount}종</p>
                </div>

                {/* CS 현황 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>처리 대기 CS</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${csSummary.pendingCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {csSummary.pendingCount > 0 ? '처리 필요' : '모두 완료'}
                        </span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: csSummary.pendingCount > 0 ? '#ef4444' : '#10b981' }}>
                        {csSummary.pendingCount}건
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>오늘 {csSummary.todayCount}건 접수</p>
                </div>

                {/* 월 목표 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>이번 달 목표</span>
                        <span className="text-lg">🎯</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{formatKRW(goals.monthlyGoal)}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>연간 {formatKRW(goals.annualGoal)}</p>
                </div>

                {/* 직원 수 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>팀 현황</span>
                        <span className="text-lg">👥</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{hrSummary.headCount}명</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>재고 자산 인당 {formatKRW(perCapita)}</p>
                </div>
            </div>

            {/* ─── 시즌별 재고 분포 ─── */}
            {inventorySummary.seasons.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>시즌별 재고 분포</h3>
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>원가 기준 · 실시간</span>
                    </div>

                    {/* 비율 바 */}
                    <div className="flex h-6 rounded-lg overflow-hidden mb-4">
                        {inventorySummary.seasons.map((s, i) => (
                            <div
                                key={s.season}
                                style={{ width: `${s.percent}%`, background: SEASON_COLORS[i] || '#e2e8f0', minWidth: s.percent > 0 ? '2px' : '0' }}
                                title={`${s.season}: ${s.percent}%`}
                                className="relative"
                            >
                                {s.percent > 8 && (
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                        {s.season}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {inventorySummary.seasons.slice(0, 6).map((s, i) => (
                            <div key={s.season} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: "var(--bg)" }}>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEASON_COLORS[i] || '#e2e8f0' }} />
                                    <span style={{ color: "var(--text-secondary)" }}>{s.season}</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatKRW(s.value)}</span>
                                    <span className="ml-1" style={{ color: "var(--text-tertiary)" }}>({s.percent}%)</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── 바로가기 링크 ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { href: '/inventory', label: '재고 관리', icon: '📦', color: '#6366f1' },
                    { href: '/orders/cs', label: 'CS 처리', icon: '💬', color: '#f59e0b', badge: csSummary.pendingCount },
                    { href: '/hr/attendance', label: '출퇴근 관리', icon: '⏰', color: '#10b981' },
                    { href: '/hr', label: '인사 관리', icon: '👥', color: '#8b5cf6' },
                ].map(item => (
                    <a
                        key={item.href}
                        href={item.href}
                        className="relative rounded-xl p-4 flex flex-col items-center gap-2 transition-transform hover:scale-105"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
                    >
                        {item.badge ? (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {item.badge > 9 ? '9+' : item.badge}
                            </span>
                        ) : null}
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                    </a>
                ))}
            </div>

        </div>
    );
}
