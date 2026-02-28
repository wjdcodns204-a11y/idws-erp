// 메인 대시보드 — 구글 시트 데이터 구조 반영
// 매출 요약, 채널별 비중, 월별 추이, 재고 자산, TOP 상품을 한눈에 표시

// ─── 매출 요약 카드 데이터 (구글 시트 "전체 매출 상태 대시보드" 탭 기반) ───
const SALES_SUMMARY = {
    currentMonth: "26/02",
    totalSales: 265_774_527,
    prevMonthSales: 216_479_426,
    headCount: 6,
    perCapita: 44_295_755,
    financialStatus: "매우충분" as const,
    targetSales: 210_000_000,
    gap: -55_774_527,
};

// ─── 채널별 매출 (구글 시트 "월간매출표" 탭 기반, 8채널) ───
const CHANNEL_SALES = [
    { channel: "무신사 온라인", amount: 239_825_867, percent: 78.3, color: "#6366f1", orders: 1842 },
    { channel: "기타 플랫폼", amount: 23_805_913, percent: 7.8, color: "#8b5cf6", orders: 312 },
    { channel: "자사몰 (LLUD)", amount: 2_142_747, percent: 0.7, color: "#a78bfa", orders: 45 },
    { channel: "무신사 글로벌", amount: 0, percent: 0, color: "#c4b5fd", orders: 0 },
];

// ─── 월별 매출 추이 (구글 시트 "전체 매출 상태 대시보드" 13개월) ───
const MONTHLY_TREND = [
    { month: "25/02", total: 264_174_815 },
    { month: "25/03", total: 250_629_875 },
    { month: "25/04", total: 210_338_516 },
    { month: "25/05", total: 188_469_693 },
    { month: "25/06", total: 455_175_230 },
    { month: "25/07", total: 186_247_078 },
    { month: "25/08", total: 176_313_029 },
    { month: "25/09", total: 290_287_358 },
    { month: "25/10", total: 361_612_991 },
    { month: "25/11", total: 429_108_198 },
    { month: "25/12", total: 196_689_714 },
    { month: "26/01", total: 216_479_426 },
    { month: "26/02", total: 265_774_527 },
];

// ─── 재고 자산 요약 (구글 시트 "집계장 대시보드" 탭 기반) ───
const INVENTORY_SUMMARY = {
    totalAsset: 748_981_121,
    totalQuantity: 39_675,
    seasons: [
        { season: "26SS", qty: 9833, value: 207_304_949, percent: 22.48 },
        { season: "25FW", qty: 6179, value: 148_195_725, percent: 16.07 },
        { season: "25SS", qty: 8823, value: 164_352_902, percent: 17.83 },
        { season: "24FW", qty: 4924, value: 127_521_568, percent: 13.83 },
        { season: "24SS", qty: 8108, value: 227_806_489, percent: 24.71 },
        { season: "23FW", qty: 1380, value: 46_844_204, percent: 5.08 },
    ],
};

// ─── TOP 판매 상품 (구글 시트 "TOP 20" 탭 기반) ───
const TOP_PRODUCTS = [
    { code: "I24FWBC002-CH", name: "Saga Leaf Maxi Cap Charcoal", category: "ACC", weekAvg: 55.3, stock: 454, salesRate: "80.7%", margin: "45%" },
    { code: "I24FWBC002-BK", name: "Saga Leaf Maxi Cap Black", category: "ACC", weekAvg: 44.3, stock: 419, salesRate: "78.7%", margin: "45%" },
    { code: "I25FWBN001-BK", name: "Ethnic Jacquard Maxi Beanie Black", category: "ACC", weekAvg: 38.8, stock: 484, salesRate: "72.9%", margin: "46%" },
    { code: "I25SSBC003-BM", name: "Scorpion Wappen Maxi Cap Black/Multi", category: "ACC", weekAvg: 34.8, stock: 323, salesRate: "120.5%", margin: "48%" },
    { code: "I25FWJP001-BK", name: "Plane Shirring Ma-1 Black", category: "OUTER", weekAvg: 32.0, stock: 88, salesRate: "71.6%", margin: "41%" },
];

// ─── 헬퍼 함수 ───
function formatKRW(value: number): string {
    if (Math.abs(value) >= 100_000_000) return `₩${(value / 100_000_000).toFixed(1)}억`;
    if (Math.abs(value) >= 10_000) return `₩${Math.round(value / 10_000).toLocaleString()}만`;
    return `₩${value.toLocaleString()}`;
}

function formatPercent(current: number, prev: number): { value: string; positive: boolean } {
    if (prev === 0) return { value: "+∞%", positive: true };
    const diff = ((current - prev) / prev) * 100;
    return { value: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`, positive: diff >= 0 };
}

// ─── 주문 현황 (오늘) ───
const ORDER_STATUS = {
    todayOrders: 4,
    todayAmount: 430_000,
    pendingCount: 5,
    shippingCount: 4,
    issueCount: 3,
};

const RECENT_ORDERS = [
    { id: 'ORD-0223-001', channel: '무신사', item: 'Saga Leaf Maxi Cap Charcoal 외 1건', amount: 74000, status: '결제완료', statusColor: '#6366f1' },
    { id: 'ORD-0223-002', channel: '무신사', item: 'Plane Shirring Ma-1 Black', amount: 189000, status: '상품준비중', statusColor: '#f59e0b' },
    { id: 'ORD-0223-003', channel: '29CM', item: 'Scorpion Wappen Maxi Cap ×2', amount: 78000, status: '결제완료', statusColor: '#6366f1' },
    { id: 'ORD-0223-004', channel: 'LLUD', item: 'Hertz Track Line Pants Black', amount: 89000, status: '상품준비중', statusColor: '#f59e0b' },
    { id: 'ORD-0222-005', channel: '무신사', item: 'Saga Leaf Maxi Cap + Ma-1', amount: 228000, status: '출고완료', statusColor: '#3b82f6' },
];

export default function DashboardPage() {
    const monthChange = formatPercent(SALES_SUMMARY.totalSales, SALES_SUMMARY.prevMonthSales);
    const maxMonthly = Math.max(...MONTHLY_TREND.map(m => m.total));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* 헤더 */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>대시보드</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>2026년 2월 매출 현황 · 22일까지 집계</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
                    style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    실시간 업데이트
                </div>
            </div>

            {/* ─── 매출 요약 카드 4개 ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* 월 매출 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>이번 달 매출</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${monthChange.positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                            {monthChange.value}
                        </span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                        {formatKRW(SALES_SUMMARY.totalSales)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>전월 {formatKRW(SALES_SUMMARY.prevMonthSales)}</p>
                </div>

                {/* 인당매출 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>인당 매출</span>
                        <span className="text-xs text-slate-500">{SALES_SUMMARY.headCount}명</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                        {formatKRW(SALES_SUMMARY.perCapita)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>전체매출 ÷ {SALES_SUMMARY.headCount}명</p>
                </div>

                {/* 재무상태 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>재무 상태</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            {SALES_SUMMARY.financialStatus}
                        </span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
                        목표 대비 {formatKRW(Math.abs(SALES_SUMMARY.gap))} 초과
                    </p>
                </div>

                {/* 재고 자산 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>총 재고 자산</span>
                        <span className="text-xs text-slate-500">{INVENTORY_SUMMARY.totalQuantity.toLocaleString()}개</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                        {formatKRW(INVENTORY_SUMMARY.totalAsset)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{INVENTORY_SUMMARY.seasons.length}개 시즌 보유</p>
                </div>
            </div>

            {/* ─── 주문 현황 카드 + 최근 주문 ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 주문 상태 카드 3개 */}
                <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>오늘 주문</span>
                            <span className="text-sm">📦</span>
                        </div>
                        <p className="text-xl font-bold" style={{ color: "#6366f1" }}>{ORDER_STATUS.todayOrders}건</p>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>{formatKRW(ORDER_STATUS.todayAmount)}</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>처리 대기</span>
                            <span className="text-sm">⏳</span>
                        </div>
                        <p className="text-xl font-bold" style={{ color: "#f59e0b" }}>{ORDER_STATUS.pendingCount}건</p>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>결제완료 + 준비중</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>취소/반품</span>
                            <span className="text-sm">⚠️</span>
                        </div>
                        <p className="text-xl font-bold" style={{ color: "#ef4444" }}>{ORDER_STATUS.issueCount}건</p>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>요청 처리 필요</p>
                    </div>
                </div>

                {/* 최근 주문 미니 테이블 */}
                <div className="lg:col-span-2 rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>최근 주문</h3>
                        <a href="/orders" className="text-xs font-medium hover:underline" style={{ color: "var(--primary)" }}>전체 보기 →</a>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border)" }}>
                                    <th className="pb-2 text-left font-medium">주문번호</th>
                                    <th className="pb-2 text-left font-medium hidden sm:table-cell">채널</th>
                                    <th className="pb-2 text-left font-medium">상품</th>
                                    <th className="pb-2 text-right font-medium">금액</th>
                                    <th className="pb-2 text-center font-medium">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RECENT_ORDERS.map(o => (
                                    <tr key={o.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: "1px solid var(--border-light)" }}>
                                        <td className="py-2 font-mono text-[10px]" style={{ color: "var(--primary)" }}>{o.id}</td>
                                        <td className="py-2 hidden sm:table-cell" style={{ color: "var(--text-tertiary)" }}>{o.channel}</td>
                                        <td className="py-2 truncate max-w-[140px]" style={{ color: "var(--text-secondary)" }}>{o.item}</td>
                                        <td className="py-2 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{formatKRW(o.amount)}</td>
                                        <td className="py-2 text-center">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                                style={{ backgroundColor: `${o.statusColor}15`, color: o.statusColor }}>
                                                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: o.statusColor }} />
                                                {o.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ─── 2열 그리드: 월별 추이 + 채널별 비중 ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 월별 매출 추이 (2/3 너비) */}
                <div className="lg:col-span-2 rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>월별 매출 추이</h3>
                    <div className="flex items-end gap-1.5 h-40">
                        {MONTHLY_TREND.map((m, i) => {
                            const heightPercent = (m.total / maxMonthly) * 100;
                            const isCurrentMonth = i === MONTHLY_TREND.length - 1;
                            return (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                                    {/* 툴팁 */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                        {formatKRW(m.total)}
                                    </div>
                                    <div
                                        className={`w-full rounded-t-md transition-all duration-300 ${isCurrentMonth ? "bg-indigo-500" : "bg-indigo-200 hover:bg-indigo-300"}`}
                                        style={{ height: `${heightPercent}%`, minHeight: "4px" }}
                                    />
                                    <span className="text-[10px] leading-none" style={{ color: "var(--text-tertiary)" }}>
                                        {m.month.split("/")[1]}월
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 채널별 매출 비중 (1/3 너비) */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>채널별 매출</h3>
                    <div className="space-y-3">
                        {CHANNEL_SALES.filter(c => c.amount > 0).map((ch) => (
                            <div key={ch.channel}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{ch.channel}</span>
                                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{formatKRW(ch.amount)}</span>
                                </div>
                                <div className="w-full h-2 rounded-full" style={{ background: "var(--border-light)" }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${ch.percent}%`, background: ch.color }}
                                    />
                                </div>
                                <div className="flex justify-between mt-0.5">
                                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{ch.percent}%</span>
                                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{ch.orders}건</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── 2열 그리드: TOP 상품 + 시즌별 재고 ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* TOP 판매 상품 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>TOP 판매 상품</h3>
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>주간 평균 기준</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border)" }}>
                                    <th className="pb-2 text-left font-medium">#</th>
                                    <th className="pb-2 text-left font-medium">상품</th>
                                    <th className="pb-2 text-right font-medium">주평균</th>
                                    <th className="pb-2 text-right font-medium hidden sm:table-cell">재고</th>
                                    <th className="pb-2 text-right font-medium hidden sm:table-cell">판매율</th>
                                    <th className="pb-2 text-right font-medium hidden sm:table-cell">마진</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TOP_PRODUCTS.map((p, i) => (
                                    <tr key={p.code} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: "1px solid var(--border-light)" }}>
                                        <td className="py-2.5 font-bold" style={{ color: i < 3 ? "var(--primary)" : "var(--text-tertiary)" }}>
                                            {i + 1}
                                        </td>
                                        <td className="py-2.5">
                                            <p className="font-medium truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                                            <p style={{ color: "var(--text-tertiary)" }}>{p.code}</p>
                                        </td>
                                        <td className="py-2.5 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{p.weekAvg}</td>
                                        <td className="py-2.5 text-right hidden sm:table-cell" style={{ color: p.stock < 100 ? "var(--danger)" : "var(--text-secondary)" }}>
                                            {p.stock.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 text-right hidden sm:table-cell" style={{ color: "var(--text-secondary)" }}>{p.salesRate}</td>
                                        <td className="py-2.5 text-right font-medium hidden sm:table-cell" style={{ color: "var(--success)" }}>{p.margin}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 시즌별 재고 분포 */}
                <div className="rounded-xl p-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>시즌별 재고 분포</h3>
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>원가 기준</span>
                    </div>

                    {/* 시즌 비중 바 */}
                    <div className="flex h-6 rounded-lg overflow-hidden mb-4">
                        {INVENTORY_SUMMARY.seasons.map((s, i) => {
                            const colors = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e0e7ff", "#f1f5f9"];
                            return (
                                <div
                                    key={s.season}
                                    className="relative group"
                                    style={{ width: `${s.percent}%`, background: colors[i] }}
                                    title={`${s.season}: ${s.percent}%`}
                                >
                                    {s.percent > 10 && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                            {s.season}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 상세 리스트 */}
                    <div className="space-y-2">
                        {INVENTORY_SUMMARY.seasons.map((s, i) => {
                            const colors = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e0e7ff", "#cbd5e1"];
                            return (
                                <div key={s.season} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-sm" style={{ background: colors[i] }} />
                                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{s.season}</span>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-4 text-xs">
                                        <span className="hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>{s.qty.toLocaleString()}개</span>
                                        <span className="font-semibold w-14 sm:w-16 text-right" style={{ color: "var(--text-primary)" }}>{formatKRW(s.value)}</span>
                                        <span className="w-10 text-right" style={{ color: "var(--text-tertiary)" }}>{s.percent}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
