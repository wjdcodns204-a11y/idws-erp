'use client';

import { useState } from 'react';

type PurchaseOrderItem = {
    id: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    received_quantity: number;
};

type PurchaseOrder = {
    id: string;
    po_number: string;
    supplier_name: string;
    status: string;
    ordered_date: string;
    expected_date: string;
    received_date: string;
    total_amount: number;
    memo: string;
    created_by: string;
    approved_by: string;
    created_at: string;
    purchase_order_items: PurchaseOrderItem[];
};

type Supplier = { id: string; name: string; contact_name: string; lead_time_days: number };
type Product = { id: string; name: string; sku: string };

const STATUS_COLORS: Record<string, string> = {
    '초안': 'bg-slate-100 text-slate-600',
    '승인대기': 'bg-yellow-100 text-yellow-700',
    '발주완료': 'bg-blue-100 text-blue-700',
    '납품중': 'bg-purple-100 text-purple-700',
    '입고완료': 'bg-emerald-100 text-emerald-700',
    '취소': 'bg-red-100 text-red-600',
};

const STATUS_NEXT: Record<string, string> = {
    '승인대기': '발주완료',
    '발주완료': '납품중',
    '납품중': '입고완료',
};

function formatKRW(v: number) {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
    if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만원`;
    return `${v.toLocaleString()}원`;
}

export default function PurchaseOrdersClient({
    initialOrders,
    suppliers,
    products,
}: {
    initialOrders: PurchaseOrder[];
    suppliers: Supplier[];
    products: Product[];
}) {
    const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [filterStatus, setFilterStatus] = useState('전체');
    const [saving, setSaving] = useState(false);

    // 새 발주서 폼 상태
    const [form, setForm] = useState({
        supplier_name: '',
        supplier_id: '',
        expected_date: '',
        memo: '',
        items: [{ product_name: '', sku: '', quantity: 1, unit_price: 0 }],
    });

    const filteredOrders = filterStatus === '전체'
        ? orders
        : orders.filter(o => o.status === filterStatus);

    const handleAddItem = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { product_name: '', sku: '', quantity: 1, unit_price: 0 }]
        }));
    };

    const handleItemChange = (idx: number, field: string, value: string | number) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item)
        }));
    };

    const handleProductSelect = (idx: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setForm(prev => ({
                ...prev,
                items: prev.items.map((item, i) =>
                    i === idx ? { ...item, product_name: product.name, sku: product.sku } : item
                )
            }));
        }
    };

    const handleSupplierSelect = (supplierId: string) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() + (supplier.lead_time_days || 14));
            setForm(prev => ({
                ...prev,
                supplier_id: supplierId,
                supplier_name: supplier.name,
                expected_date: expectedDate.toISOString().slice(0, 10),
            }));
        }
    };

    const handleCreate = async () => {
        if (!form.supplier_name.trim()) return alert('공급업체를 선택하거나 입력해주세요.');
        if (form.items.some(i => !i.product_name.trim())) return alert('모든 품목명을 입력해주세요.');

        setSaving(true);
        try {
            const res = await fetch('/api/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error); return; }

            // 목록 새로고침
            const listRes = await fetch('/api/purchase-orders');
            const newList = await listRes.json();
            setOrders(newList);
            setShowCreate(false);
            setForm({ supplier_name: '', supplier_id: '', expected_date: '', memo: '', items: [{ product_name: '', sku: '', quantity: 1, unit_price: 0 }] });
            alert(`✅ ${data.message}`);
        } catch { alert('오류 발생'); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        if (!confirm(`상태를 "${newStatus}"으로 변경할까요?`)) return;
        const res = await fetch(`/api/purchase-orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            ));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
            }
        }
    };

    const totalByStatus = (status: string) => orders.filter(o => o.status === status).length;

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">발주 관리</h1>
                    <p className="text-sm text-slate-500 mt-1">공급업체 발주서를 생성하고 입고까지 추적합니다.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all active:scale-95"
                >
                    + 새 발주서
                </button>
            </div>

            {/* 상태 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {['승인대기', '발주완료', '납품중', '입고완료', '취소'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(filterStatus === status ? '전체' : status)}
                        className={`rounded-xl p-3 text-center transition-all border ${filterStatus === status ? 'border-indigo-500 shadow-md' : 'border-slate-200'}`}
                        style={{ background: filterStatus === status ? '#6366f110' : 'white' }}
                    >
                        <p className={`text-xl font-bold ${STATUS_COLORS[status]?.split(' ')[1]}`}>{totalByStatus(status)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{status}</p>
                    </button>
                ))}
            </div>

            {/* 발주서 목록 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left">발주번호</th>
                                <th className="px-4 py-3 text-left">공급업체</th>
                                <th className="px-4 py-3 text-center">상태</th>
                                <th className="px-4 py-3 text-right">금액</th>
                                <th className="px-4 py-3 text-center hidden sm:table-cell">발주일</th>
                                <th className="px-4 py-3 text-center hidden sm:table-cell">납기예정</th>
                                <th className="px-4 py-3 text-center">액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        발주서가 없습니다. 새 발주서를 작성해보세요.
                                    </td>
                                </tr>
                            ) : filteredOrders.map(order => (
                                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}>
                                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-semibold">{order.po_number}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{order.supplier_name}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || ''}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                                        {formatKRW(order.total_amount)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-500 text-xs hidden sm:table-cell">
                                        {order.ordered_date || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-500 text-xs hidden sm:table-cell">
                                        {order.expected_date || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                        {STATUS_NEXT[order.status] && (
                                            <button
                                                onClick={() => handleStatusChange(order.id, STATUS_NEXT[order.status])}
                                                className="px-3 py-1 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all"
                                            >
                                                {STATUS_NEXT[order.status]} →
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 발주서 상세 패널 */}
            {selectedOrder && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">{selectedOrder.po_number}</h3>
                            <p className="text-sm text-slate-500">{selectedOrder.supplier_name} · 작성: {selectedOrder.created_by}</p>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                    </div>
                    {selectedOrder.memo && (
                        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600">{selectedOrder.memo}</div>
                    )}
                    <table className="w-full text-sm">
                        <thead className="text-xs text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="pb-2 text-left">상품명</th>
                                <th className="pb-2 text-left">SKU</th>
                                <th className="pb-2 text-right">발주수량</th>
                                <th className="pb-2 text-right">단가</th>
                                <th className="pb-2 text-right">소계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(selectedOrder.purchase_order_items || []).map(item => (
                                <tr key={item.id} className="border-b border-slate-50">
                                    <td className="py-2 font-medium text-slate-800">{item.product_name}</td>
                                    <td className="py-2 font-mono text-xs text-slate-500">{item.sku || '-'}</td>
                                    <td className="py-2 text-right text-slate-700">{item.quantity}개</td>
                                    <td className="py-2 text-right text-slate-500">{item.unit_price.toLocaleString()}원</td>
                                    <td className="py-2 text-right font-semibold text-slate-800">
                                        {(item.quantity * item.unit_price).toLocaleString()}원
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-200">
                                <td colSpan={4} className="pt-2 text-right font-bold text-slate-700">합계</td>
                                <td className="pt-2 text-right font-bold text-indigo-700 text-base">
                                    {selectedOrder.total_amount.toLocaleString()}원
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* 새 발주서 모달 */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">새 발주서 작성</h2>
                            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* 공급업체 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">공급업체</label>
                                <select
                                    value={form.supplier_id}
                                    onChange={e => handleSupplierSelect(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">공급업체 선택</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                    <option value="__custom">직접 입력</option>
                                </select>
                                {(!form.supplier_id || form.supplier_id === '__custom') && (
                                    <input
                                        type="text" value={form.supplier_name}
                                        onChange={e => setForm(prev => ({ ...prev, supplier_name: e.target.value }))}
                                        placeholder="공급업체명 직접 입력"
                                        className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                )}
                            </div>

                            {/* 납기 예정일 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">납기 예정일</label>
                                <input type="date" value={form.expected_date}
                                    onChange={e => setForm(prev => ({ ...prev, expected_date: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* 발주 품목 */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">발주 품목</label>
                                    <button onClick={handleAddItem}
                                        className="text-xs text-indigo-600 font-semibold hover:underline">+ 품목 추가</button>
                                </div>
                                <div className="space-y-3">
                                    {form.items.map((item, idx) => (
                                        <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    onChange={e => handleProductSelect(idx, e.target.value)}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    <option value="">상품 선택 (선택사항)</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <input type="text" value={item.product_name}
                                                    onChange={e => handleItemChange(idx, 'product_name', e.target.value)}
                                                    placeholder="품목명 *"
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <input type="text" value={item.sku}
                                                    onChange={e => handleItemChange(idx, 'sku', e.target.value)}
                                                    placeholder="SKU"
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <input type="number" value={item.quantity} min={1}
                                                    onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                                    placeholder="수량"
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <input type="number" value={item.unit_price} min={0}
                                                    onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                                                    placeholder="단가(원)"
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* 합계 미리보기 */}
                                <div className="mt-2 text-right text-sm font-semibold text-slate-700">
                                    예상 합계: {form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString()}원
                                </div>
                            </div>

                            {/* 메모 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">메모</label>
                                <textarea value={form.memo}
                                    onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
                                    rows={2} placeholder="특이사항이 있으면 입력해주세요"
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                        </div>
                        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button onClick={() => setShowCreate(false)}
                                className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                                취소
                            </button>
                            <button onClick={handleCreate} disabled={saving}
                                className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:bg-slate-300">
                                {saving ? '저장 중...' : '발주서 생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
