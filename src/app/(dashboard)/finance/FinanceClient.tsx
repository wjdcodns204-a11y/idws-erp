'use client';

import { useState, useCallback } from 'react';

type Revenue = {
    id: string; platform: string; gross_sales: number;
    returns_amount: number; net_sales: number; platform_fee: number; platform_fee_pct: number;
};
type Expense = { id: string; category: string; amount: number; description: string };
type TaxInvoice = {
    id: string; type: string; invoice_date: string; company_name: string;
    amount: number; vat: number; total_amount: number; item_description: string; status: string;
};
type PlatformFee = { platform_name: string; fee_pct: number };

const PLATFORMS = ['무신사', '29CM', 'W컨셉', '에이블리', '자사몰', '카페24', '기타'];
const EXPENSE_CATEGORIES = ['매입원가', '인건비', '광고비', '물류비', '임대료', '기타운영비', '카드수수료'];

function formatKRW(v: number): string {
    const abs = Math.abs(v);
    const prefix = v < 0 ? '-' : '';
    if (abs >= 100_000_000) return `${prefix}${(abs / 100_000_000).toFixed(1)}억`;
    if (abs >= 10_000) return `${prefix}${Math.round(abs / 10_000).toLocaleString()}만`;
    return `${prefix}${abs.toLocaleString()}원`;
}

type Tab = 'pl' | 'expense' | 'tax';

export default function FinanceClient({
    initialRevenues, initialExpenses, initialTaxInvoices, platformFees, currentMonth,
}: {
    initialRevenues: Revenue[];
    initialExpenses: Expense[];
    initialTaxInvoices: TaxInvoice[];
    platformFees: PlatformFee[];
    currentMonth: string;
}) {
    const [tab, setTab] = useState<Tab>('pl');
    const [month, setMonth] = useState(currentMonth);
    const [revenues, setRevenues] = useState<Revenue[]>(initialRevenues);
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>(initialTaxInvoices);
    const [saving, setSaving] = useState(false);

    // 매출 입력 폼
    const [revForm, setRevForm] = useState({
        platform: '무신사', gross_sales: 0, returns_amount: 0,
        platform_fee_pct: 0,
    });

    // 비용 입력 폼
    const [expForm, setExpForm] = useState({ category: '매입원가', amount: 0, description: '' });

    // 세금계산서 폼
    const [taxForm, setTaxForm] = useState({
        type: '발행', invoice_date: new Date().toISOString().slice(0, 10),
        company_name: '', amount: 0, item_description: '',
    });

    // 월별 데이터 다시 로드
    const reloadMonth = useCallback(async (m: string) => {
        const res = await fetch(`/api/finance/pl?month=${m}`);
        const data = await res.json();
        setRevenues(data.revenues || []);
        setExpenses(data.expenses || []);
    }, []);

    const handleMonthChange = async (m: string) => {
        setMonth(m);
        await reloadMonth(m);
    };

    // 손익 집계
    const totalGross = revenues.reduce((s, r) => s + (r.gross_sales || 0), 0);
    const totalReturns = revenues.reduce((s, r) => s + (r.returns_amount || 0), 0);
    const totalFees = revenues.reduce((s, r) => s + (r.platform_fee || 0), 0);
    const netRevenue = totalGross - totalReturns;
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const operatingProfit = netRevenue - totalFees - totalExpenses;
    const margin = netRevenue > 0 ? Math.round((operatingProfit / netRevenue) * 100) : 0;

    // 매출 저장
    const handleRevenueSave = async () => {
        if (!revForm.platform || revForm.gross_sales <= 0) return alert('플랫폼과 매출액을 입력해주세요.');
        setSaving(true);
        const pf = platformFees.find(p => p.platform_name === revForm.platform);
        const res = await fetch('/api/finance/revenue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...revForm, year_month: month, platform_fee_pct: revForm.platform_fee_pct || pf?.fee_pct || 0 }),
        });
        if (res.ok) {
            await reloadMonth(month);
            setRevForm({ platform: '무신사', gross_sales: 0, returns_amount: 0, platform_fee_pct: 0 });
        }
        setSaving(false);
    };

    // 비용 저장
    const handleExpenseSave = async () => {
        if (expForm.amount <= 0) return alert('금액을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/finance/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...expForm, year_month: month }),
        });
        if (res.ok) {
            const data = await res.json();
            setExpenses(prev => [...prev, data]);
            setExpForm({ category: '매입원가', amount: 0, description: '' });
        }
        setSaving(false);
    };

    // 비용 삭제
    const handleExpenseDelete = async (id: string) => {
        await fetch('/api/finance/expenses', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        setExpenses(prev => prev.filter(e => e.id !== id));
    };

    // 세금계산서 저장
    const handleTaxSave = async () => {
        if (!taxForm.company_name.trim() || taxForm.amount <= 0) return alert('거래처명과 금액을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/finance/tax-invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taxForm),
        });
        if (res.ok) {
            const data = await res.json();
            setTaxInvoices(prev => [data, ...prev]);
            setTaxForm({ type: '발행', invoice_date: new Date().toISOString().slice(0, 10), company_name: '', amount: 0, item_description: '' });
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">재무·손익 관리</h1>
                    <p className="text-sm text-slate-500 mt-1">매출, 비용, 손익계산서, 세금계산서를 관리합니다.</p>
                </div>
                <input type="month" value={month} onChange={e => handleMonthChange(e.target.value)}
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold" />
            </div>

            {/* 손익 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: '순매출', value: netRevenue, color: 'text-indigo-700' },
                    { label: '플랫폼 수수료', value: -totalFees, color: 'text-orange-600' },
                    { label: '총 비용', value: -totalExpenses, color: 'text-red-600' },
                    { label: `영업이익 (${margin}%)`, value: operatingProfit, color: operatingProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                        <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                        <p className={`text-xl font-black ${card.color}`}>{formatKRW(card.value)}</p>
                    </div>
                ))}
            </div>

            {/* 탭 */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {([['pl', '📊 손익계산서'], ['expense', '💸 비용 입력'], ['tax', '🧾 세금계산서']] as [Tab, string][]).map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── 손익계산서 탭 ── */}
            {tab === 'pl' && (
                <div className="space-y-4">
                    {/* 매출 입력 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">📥 플랫폼별 매출 입력</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                            <select value={revForm.platform} onChange={e => {
                                const pf = platformFees.find(p => p.platform_name === e.target.value);
                                setRevForm(prev => ({ ...prev, platform: e.target.value, platform_fee_pct: pf?.fee_pct || 0 }));
                            }}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                            </select>
                            <input type="number" placeholder="총 매출(원)" value={revForm.gross_sales || ''}
                                onChange={e => setRevForm(prev => ({ ...prev, gross_sales: Number(e.target.value) }))}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            <input type="number" placeholder="반품금액(원)" value={revForm.returns_amount || ''}
                                onChange={e => setRevForm(prev => ({ ...prev, returns_amount: Number(e.target.value) }))}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            <div className="flex items-center gap-1">
                                <input type="number" step="0.1" placeholder="수수료%" value={revForm.platform_fee_pct || ''}
                                    onChange={e => setRevForm(prev => ({ ...prev, platform_fee_pct: Number(e.target.value) }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                <span className="text-slate-400 text-sm">%</span>
                            </div>
                            <button onClick={handleRevenueSave} disabled={saving}
                                className="py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:bg-slate-300">
                                저장
                            </button>
                        </div>

                        {/* 매출 목록 */}
                        {revenues.length > 0 && (
                            <table className="w-full text-sm mt-2">
                                <thead className="text-xs text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="pb-2 text-left">플랫폼</th>
                                        <th className="pb-2 text-right">총매출</th>
                                        <th className="pb-2 text-right">반품</th>
                                        <th className="pb-2 text-right">순매출</th>
                                        <th className="pb-2 text-right">수수료</th>
                                        <th className="pb-2 text-right">실수익</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revenues.map(r => (
                                        <tr key={r.id} className="border-b border-slate-50">
                                            <td className="py-2 font-semibold text-slate-800">{r.platform}</td>
                                            <td className="py-2 text-right text-slate-600">{formatKRW(r.gross_sales)}</td>
                                            <td className="py-2 text-right text-red-500">-{formatKRW(r.returns_amount)}</td>
                                            <td className="py-2 text-right text-slate-700">{formatKRW(r.net_sales)}</td>
                                            <td className="py-2 text-right text-orange-500">-{formatKRW(r.platform_fee)}</td>
                                            <td className="py-2 text-right font-bold text-indigo-700">{formatKRW(r.net_sales - r.platform_fee)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t border-slate-200 font-bold">
                                    <tr>
                                        <td className="pt-2 text-slate-700">합계</td>
                                        <td className="pt-2 text-right text-slate-600">{formatKRW(totalGross)}</td>
                                        <td className="pt-2 text-right text-red-500">-{formatKRW(totalReturns)}</td>
                                        <td className="pt-2 text-right text-slate-700">{formatKRW(netRevenue)}</td>
                                        <td className="pt-2 text-right text-orange-500">-{formatKRW(totalFees)}</td>
                                        <td className="pt-2 text-right text-indigo-700">{formatKRW(netRevenue - totalFees)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>

                    {/* 손익 요약 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">📋 {month} 손익계산서 요약</h3>
                        <div className="space-y-2 text-sm">
                            {[
                                { label: '총 매출', value: totalGross, indent: false },
                                { label: '(-) 반품/환불', value: -totalReturns, indent: true },
                                { label: '= 순매출', value: netRevenue, indent: false, bold: true },
                                { label: '(-) 플랫폼 수수료', value: -totalFees, indent: true },
                                { label: '= 매출총이익', value: netRevenue - totalFees, indent: false, bold: true },
                                { label: '(-) 총 비용', value: -totalExpenses, indent: true },
                                { label: `= 영업이익 (마진 ${margin}%)`, value: operatingProfit, indent: false, bold: true, highlight: true },
                            ].map((row, i) => (
                                <div key={i} className={`flex justify-between py-1.5 ${row.indent ? 'pl-4 text-slate-500' : ''} ${row.bold ? 'font-bold border-t border-slate-100 pt-2' : ''} ${row.highlight ? (operatingProfit >= 0 ? 'text-emerald-700' : 'text-red-600') : ''}`}>
                                    <span>{row.label}</span>
                                    <span className={row.value < 0 ? 'text-red-500' : ''}>{formatKRW(row.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 비용 입력 탭 ── */}
            {tab === 'expense' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">💸 비용 추가</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <select value={expForm.category} onChange={e => setExpForm(prev => ({ ...prev, category: e.target.value }))}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                            <input type="number" placeholder="금액(원)" value={expForm.amount || ''}
                                onChange={e => setExpForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            <input type="text" placeholder="상세 내용" value={expForm.description}
                                onChange={e => setExpForm(prev => ({ ...prev, description: e.target.value }))}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button onClick={handleExpenseSave} disabled={saving}
                                className="py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:bg-slate-300">
                                비용 추가
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-5 py-3 text-left">카테고리</th>
                                    <th className="px-5 py-3 text-right">금액</th>
                                    <th className="px-5 py-3 text-left">내용</th>
                                    <th className="px-5 py-3 text-center">삭제</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-slate-400">비용 데이터가 없습니다</td></tr>
                                ) : expenses.map(e => (
                                    <tr key={e.id} className="border-b border-slate-50">
                                        <td className="px-5 py-3">
                                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{e.category}</span>
                                        </td>
                                        <td className="px-5 py-3 text-right font-semibold text-rose-600">{formatKRW(e.amount)}</td>
                                        <td className="px-5 py-3 text-slate-500 text-xs">{e.description || '-'}</td>
                                        <td className="px-5 py-3 text-center">
                                            <button onClick={() => handleExpenseDelete(e.id)}
                                                className="text-xs px-3 py-1 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all">삭제</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {expenses.length > 0 && (
                                <tfoot className="border-t border-slate-200">
                                    <tr>
                                        <td className="px-5 py-3 font-bold text-slate-700">합계</td>
                                        <td className="px-5 py-3 text-right font-bold text-rose-700">{formatKRW(totalExpenses)}</td>
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* ── 세금계산서 탭 ── */}
            {tab === 'tax' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">🧾 세금계산서 등록</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">유형</label>
                                <div className="flex rounded-xl overflow-hidden border border-slate-200">
                                    {['발행', '수령'].map(t => (
                                        <button key={t} onClick={() => setTaxForm(prev => ({ ...prev, type: t }))}
                                            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${taxForm.type === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                                            {t === '발행' ? '📤 발행(매출)' : '📥 수령(매입)'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">발행일</label>
                                <input type="date" value={taxForm.invoice_date}
                                    onChange={e => setTaxForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">거래처명 *</label>
                                <input type="text" value={taxForm.company_name}
                                    onChange={e => setTaxForm(prev => ({ ...prev, company_name: e.target.value }))}
                                    placeholder="(주)거래처" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">공급가액(원) *</label>
                                <input type="number" value={taxForm.amount || ''}
                                    onChange={e => setTaxForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                    placeholder="0" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                {taxForm.amount > 0 && (
                                    <p className="text-xs text-slate-400 mt-1">부가세: {formatKRW(Math.round(taxForm.amount * 0.1))} / 합계: {formatKRW(Math.round(taxForm.amount * 1.1))}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">품목</label>
                                <input type="text" value={taxForm.item_description}
                                    onChange={e => setTaxForm(prev => ({ ...prev, item_description: e.target.value }))}
                                    placeholder="의류 납품 외" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="flex items-end">
                                <button onClick={handleTaxSave} disabled={saving}
                                    className="w-full py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:bg-slate-300">
                                    등록
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-center">유형</th>
                                    <th className="px-4 py-3 text-left">발행일</th>
                                    <th className="px-4 py-3 text-left">거래처</th>
                                    <th className="px-4 py-3 text-right">공급가액</th>
                                    <th className="px-4 py-3 text-right">부가세</th>
                                    <th className="px-4 py-3 text-right">합계</th>
                                    <th className="px-4 py-3 text-center">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxInvoices.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">등록된 세금계산서가 없습니다</td></tr>
                                ) : taxInvoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-slate-50">
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${inv.type === '발행' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {inv.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{inv.invoice_date}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{inv.company_name}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatKRW(inv.amount)}</td>
                                        <td className="px-4 py-3 text-right text-slate-400">{formatKRW(inv.vat)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatKRW(inv.total_amount)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${inv.status === '취소' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
