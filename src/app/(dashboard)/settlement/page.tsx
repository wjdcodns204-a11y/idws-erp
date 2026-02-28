// 정산 관리 페이지 — 구글 시트 "무신사 일별매출" 정산 구조 반영
// 채널별 수수료, 월별 정산, 마진율 분석

const CHANNEL_COMMISSION = [
    { channel: "무신사 온라인", rate: 30, type: "위탁" as const, active: true },
    { channel: "무신사 글로벌", rate: 35, type: "위탁" as const, active: true },
    { channel: "무신사 오프라인", rate: 40, type: "위탁" as const, active: true },
    { channel: "29CM", rate: 30, type: "위탁" as const, active: true },
    { channel: "LLUD (자사몰)", rate: 3.5, type: "PG" as const, active: true },
    { channel: "EE플레이스", rate: 35, type: "위탁" as const, active: true },
    { channel: "비하이브", rate: 35, type: "위탁" as const, active: true },
    { channel: "행사 오프라인", rate: 0, type: "직영" as const, active: false },
];

const MONTHLY_SETTLEMENT = [
    { month: "26/02", grossSales: 265_774_527, commission: 72_659_000, costOfGoods: 68_250_000, netProfit: 124_865_527, marginRate: 47.0 },
    { month: "26/01", grossSales: 216_479_426, commission: 57_890_000, costOfGoods: 55_430_000, netProfit: 103_159_426, marginRate: 47.6 },
    { month: "25/12", grossSales: 196_689_714, commission: 52_780_000, costOfGoods: 48_920_000, netProfit: 94_989_714, marginRate: 48.3 },
    { month: "25/11", grossSales: 429_108_198, commission: 121_350_000, costOfGoods: 112_400_000, netProfit: 195_358_198, marginRate: 45.5 },
    { month: "25/10", grossSales: 361_612_991, commission: 100_250_000, costOfGoods: 93_180_000, netProfit: 168_182_991, marginRate: 46.5 },
    { month: "25/09", grossSales: 290_287_358, commission: 81_540_000, costOfGoods: 74_430_000, netProfit: 134_317_358, marginRate: 46.3 },
];

function formatKRW(value: number): string {
    if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
    if (Math.abs(value) >= 10_000) return `${Math.round(value / 10_000).toLocaleString()}만`;
    return value.toLocaleString();
}

export default function SettlementPage() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>정산 관리</h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>채널별 수수료 · 월별 정산 · 마진 분석</p>
            </div>

            {/* ─── 당월 정산 요약 ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { label: "총매출", value: 265_774_527, color: "var(--text-primary)" },
                    { label: "총 수수료", value: -72_659_000, color: "var(--danger)" },
                    { label: "매출 원가", value: -68_250_000, color: "var(--warning)" },
                    { label: "순이익", value: 124_865_527, color: "var(--success)" },
                ].map(item => (
                    <div key={item.label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>{item.label}</p>
                        <p className="text-xl font-bold" style={{ color: item.color }}>₩{formatKRW(item.value)}</p>
                    </div>
                ))}
            </div>

            {/* ─── 채널별 수수료율 설정 ─── */}
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>채널별 수수료율</h3>
                    <button className="text-xs px-3 py-1.5 rounded-lg font-medium text-white cursor-pointer"
                        style={{ background: "var(--primary)" }}>
                        + 채널 추가
                    </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {CHANNEL_COMMISSION.map(ch => (
                        <div key={ch.channel} className={`p-3 rounded-lg border ${ch.active ? "" : "opacity-50"}`}
                            style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{ch.channel}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${ch.type === "위탁" ? "bg-indigo-50 text-indigo-600" : ch.type === "PG" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                                    {ch.type}
                                </span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: ch.rate > 30 ? "var(--warning)" : "var(--text-primary)" }}>
                                {ch.rate}%
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── 월별 정산 테이블 ─── */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="p-5 pb-3">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>월별 정산 집계</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ background: "var(--background)", color: "var(--text-tertiary)" }}>
                                <th className="px-5 py-3 text-left font-medium">기간</th>
                                <th className="px-3 py-3 text-right font-medium">총매출</th>
                                <th className="px-3 py-3 text-right font-medium">수수료</th>
                                <th className="px-3 py-3 text-right font-medium">매출원가</th>
                                <th className="px-3 py-3 text-right font-medium">순이익</th>
                                <th className="px-3 py-3 text-right font-medium">마진율</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MONTHLY_SETTLEMENT.map((row, i) => (
                                <tr key={row.month} className="hover:bg-slate-50 transition-colors"
                                    style={{ borderBottom: "1px solid var(--border-light)", fontWeight: i === 0 ? 600 : 400 }}>
                                    <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>{row.month}</td>
                                    <td className="px-3 py-3 text-right" style={{ color: "var(--text-primary)" }}>₩{formatKRW(row.grossSales)}</td>
                                    <td className="px-3 py-3 text-right" style={{ color: "var(--danger)" }}>-₩{formatKRW(row.commission)}</td>
                                    <td className="px-3 py-3 text-right" style={{ color: "var(--warning)" }}>-₩{formatKRW(row.costOfGoods)}</td>
                                    <td className="px-3 py-3 text-right font-semibold" style={{ color: "var(--success)" }}>₩{formatKRW(row.netProfit)}</td>
                                    <td className="px-3 py-3 text-right">
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${row.marginRate >= 47 ? "bg-emerald-50 text-emerald-600" : row.marginRate >= 45 ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                                            {row.marginRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
