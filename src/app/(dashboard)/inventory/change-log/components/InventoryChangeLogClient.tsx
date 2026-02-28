"use client";

import React, { useState } from 'react';

const REASONS = ['판매출고', '반품입고', '불량처리', '샘플사용', '재고조사보정', '촬영용출고', '기타'] as const;
type Reason = typeof REASONS[number];
const WAREHOUSES = ['이지어드민 창고', '무신사 오프라인', 'EE플레이스', '무신사 풀필먼트'];

const REASON_COLORS: Record<Reason, string> = {
    '판매출고': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    '반품입고': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    '불량처리': 'bg-red-50 text-red-700 border-red-100',
    '샘플사용': 'bg-purple-50 text-purple-700 border-purple-100',
    '재고조사보정': 'bg-amber-50 text-amber-700 border-amber-100',
    '촬영용출고': 'bg-pink-50 text-pink-700 border-pink-100',
    '기타': 'bg-slate-50 text-slate-700 border-slate-100',
};

type Log = {
    id: string;
    sku: string;
    product_name: string;
    reason: string;
    quantity_delta: number;
    warehouse: string;
    memo: string;
    created_at: string;
};

export default function InventoryChangeLogClient({ logs }: { logs: Log[] }) {
    const [sku, setSku] = useState('');
    const [productName, setProductName] = useState('');
    const [reason, setReason] = useState<Reason>('판매출고');
    const [qtyDelta, setQtyDelta] = useState<number>(-1); // 기본 출고(-1)
    const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
    const [memo, setMemo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sku.trim()) return alert('SKU를 입력해주세요.');
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/inventory/change-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sku, productName, reason, quantityDelta: qtyDelta, warehouse, memo }),
            });
            if (res.ok) {
                alert('기록이 저장되었습니다!');
                window.location.reload();
            } else {
                const d = await res.json();
                alert(`오류: ${d.error}`);
            }
        } catch (err: unknown) {
            alert(`오류가 발생했습니다.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* 변동 입력 폼 */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h2 className="text-base font-bold text-slate-800 mb-5">새 재고 변동 기록</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">SKU (상품코드)</label>
                            <input type="text" value={sku} onChange={e => setSku(e.target.value)}
                                placeholder="예: I26SSDP003-BK"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">상품명 (선택)</label>
                            <input type="text" value={productName} onChange={e => setProductName(e.target.value)}
                                placeholder="상품명을 입력하세요"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">변동 사유</label>
                            <select value={reason} onChange={e => setReason(e.target.value as Reason)}
                                title="변동 사유 선택"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">수량 (입고: +, 출고: -)</label>
                            <input type="number" value={qtyDelta} onChange={e => setQtyDelta(Number(e.target.value))}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">창고 위치</label>
                            <select value={warehouse} onChange={e => setWarehouse(e.target.value)}
                                title="창고 선택"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">메모 (선택)</label>
                            <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
                                placeholder="특이사항이 있으면 간단히 적어주세요"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" disabled={isSubmitting}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-8 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-slate-300 text-sm">
                            {isSubmitting ? '저장 중...' : '재고 변동 기록'}
                        </button>
                    </div>
                </form>
            </div>

            {/* 로그 리스트 */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800">최근 변동 내역 ({logs.length}건)</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase tracking-wide">
                            <tr>
                                <th className="px-5 py-3 text-left">일시</th>
                                <th className="px-5 py-3 text-left">SKU</th>
                                <th className="px-5 py-3 text-left">사유</th>
                                <th className="px-5 py-3 text-right">수량</th>
                                <th className="px-5 py-3 text-left hidden md:table-cell">창고</th>
                                <th className="px-5 py-3 text-left hidden lg:table-cell">메모</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-400">기록된 내역이 없습니다.</td></tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-slate-700">{log.sku}</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${REASON_COLORS[log.reason as Reason] || 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                                                {log.reason}
                                            </span>
                                        </td>
                                        <td className={`px-5 py-3 text-right font-bold ${log.quantity_delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {log.quantity_delta > 0 ? '+' : ''}{log.quantity_delta}
                                        </td>
                                        <td className="px-5 py-3 text-slate-500 text-xs hidden md:table-cell">{log.warehouse}</td>
                                        <td className="px-5 py-3 text-slate-400 text-xs hidden lg:table-cell truncate max-w-[160px]">{log.memo || '-'}</td>
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
