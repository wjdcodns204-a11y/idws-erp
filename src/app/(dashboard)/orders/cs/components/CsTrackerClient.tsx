"use client";

import React, { useState } from 'react';

const PLATFORMS = ['무신사', '29CM', '카페24', 'W컨셉', '자사몰', '기타'];
const CARRIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국', 'GS25', '쿠팡', '미지정'];

const STATUS_CONFIG = {
    '신규': { color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
    '처리중': { color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
    '완료': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};

type CsRequest = {
    id: string;
    platform: string;
    order_number: string;
    customer_name: string;
    request_type: string;
    reason: string;
    status: string;
    assignee: string;
    memo: string;
    tracking_number?: string;
    carrier?: string;
    exchange_item?: string;
    refund_amount?: number;
    created_at: string;
    resolved_at: string | null;
};

type BlacklistEntry = { id: string; customer_name: string; platform: string; reason: string };

type NewForm = {
    platform: string;
    order_number: string;
    customer_name: string;
    request_type: '반품' | '교환';
    reason: string;
    assignee: string;
    memo: string;
};

type Tab = 'list' | 'stats' | 'blacklist';

export default function CsTrackerClient({
    initialRequests,
    initialBlacklist,
}: {
    initialRequests: CsRequest[];
    initialBlacklist: BlacklistEntry[];
}) {
    const [requests, setRequests] = useState<CsRequest[]>(initialRequests);
    const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(initialBlacklist);
    const [tab, setTab] = useState<Tab>('list');
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('전체');
    const [filterType, setFilterType] = useState<string>('전체');
    const [isSaving, setIsSaving] = useState(false);
    const [selectedReq, setSelectedReq] = useState<CsRequest | null>(null);

    const [form, setForm] = useState<NewForm>({
        platform: '무신사', order_number: '', customer_name: '',
        request_type: '반품', reason: '', assignee: '', memo: '',
    });

    const [trackingForm, setTrackingForm] = useState({
        tracking_number: '', carrier: 'CJ대한통운', exchange_item: '', refund_amount: 0
    });

    const [blForm, setBlForm] = useState({ customer_name: '', platform: '무신사', reason: '' });

    // 블랙리스트 이름 목록 (빠른 조회용)
    const blacklistNames = new Set(blacklist.map(b => b.customer_name));

    // 필터링
    const filtered = requests.filter(r => {
        const statusOk = filterStatus === '전체' || r.status === filterStatus;
        const typeOk = filterType === '전체' || r.request_type === filterType;
        return statusOk && typeOk;
    });

    // 채널별 집계
    const channelStats = PLATFORMS.map(p => ({
        platform: p,
        total: requests.filter(r => r.platform === p).length,
        pending: requests.filter(r => r.platform === p && r.status !== '완료').length,
        returns: requests.filter(r => r.platform === p && r.request_type === '반품').length,
        exchanges: requests.filter(r => r.platform === p && r.request_type === '교환').length,
    })).filter(s => s.total > 0);

    const counts = {
        전체: requests.length,
        신규: requests.filter(r => r.status === '신규').length,
        처리중: requests.filter(r => r.status === '처리중').length,
        완료: requests.filter(r => r.status === '완료').length,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.customer_name.trim()) return alert('고객명을 입력해주세요.');
        setIsSaving(true);
        try {
            const res = await fetch('/api/cs/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                const data = await res.json();
                setRequests(prev => [data.request, ...prev]);
                setShowForm(false);
                setForm({ platform: '무신사', order_number: '', customer_name: '', request_type: '반품', reason: '', assignee: '', memo: '' });
            } else alert('저장 실패');
        } catch { alert('오류 발생'); }
        finally { setIsSaving(false); }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
        await fetch('/api/cs/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus }),
        });
    };

    const handleTrackingSave = async () => {
        if (!selectedReq) return;
        const res = await fetch('/api/cs/tracking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedReq.id, ...trackingForm }),
        });
        if (res.ok) {
            const updated = await res.json();
            setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
            setSelectedReq(updated);
            alert('✅ 배송 정보가 저장되었습니다.');
        }
    };

    const handleBlacklistAdd = async () => {
        if (!blForm.customer_name.trim()) return alert('고객명을 입력해주세요.');
        if (!blForm.reason.trim()) return alert('등록 사유를 입력해주세요.');
        const res = await fetch('/api/cs/blacklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(blForm),
        });
        if (res.ok) {
            const data = await res.json();
            setBlacklist(prev => [data, ...prev]);
            setBlForm({ customer_name: '', platform: '무신사', reason: '' });
        }
    };

    const handleBlacklistRemove = async (id: string) => {
        if (!confirm('블랙리스트에서 제거할까요?')) return;
        const res = await fetch('/api/cs/blacklist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (res.ok) setBlacklist(prev => prev.filter(b => b.id !== id));
    };

    const openTracking = (req: CsRequest) => {
        setSelectedReq(req);
        setTrackingForm({
            tracking_number: req.tracking_number || '',
            carrier: req.carrier || 'CJ대한통운',
            exchange_item: req.exchange_item || '',
            refund_amount: req.refund_amount || 0,
        });
    };

    return (
        <div className="space-y-6">
            {/* 상단 요약 카드 */}
            <div className="grid grid-cols-4 gap-4">
                {(['전체', '신규', '처리중', '완료'] as const).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`rounded-xl p-4 text-left transition-all ${filterStatus === s ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-sm'} bg-white border border-slate-100`}>
                        <p className="text-xs text-slate-500 mb-1">{s}</p>
                        <p className={`text-2xl font-black ${s === '신규' ? 'text-amber-500' : s === '처리중' ? 'text-blue-500' : s === '완료' ? 'text-emerald-500' : 'text-slate-800'}`}>
                            {counts[s]}
                        </p>
                    </button>
                ))}
            </div>

            {/* 탭 */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {[['list', 'CS 목록'], ['stats', '채널별 현황'], ['blacklist', `블랙리스트 (${blacklist.length})`]] as [Tab, string][]}
                        .map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                    </button>
                    ))}
                </div>
                {tab === 'list' && (
                    <button onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95">
                        + CS 접수 등록
                    </button>
                )}
            </div>

            {/* ── CS 목록 탭 ── */}
            {tab === 'list' && (
                <>
                    {/* 등록 폼 */}
                    {showForm && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">📋 새 CS 접수 등록</h3>
                            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">플랫폼</label>
                                    <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                        {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">요청 유형</label>
                                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                                        {(['반품', '교환'] as const).map(t => (
                                            <button key={t} type="button" onClick={() => setForm({ ...form, request_type: t })}
                                                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${form.request_type === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">담당자</label>
                                    <input type="text" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}
                                        placeholder="담당자명" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">고객명 *</label>
                                    <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                                        placeholder="홍길동" className={`w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${blacklistNames.has(form.customer_name) ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                                    {blacklistNames.has(form.customer_name) && (
                                        <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ 블랙리스트 고객입니다!</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">주문번호</label>
                                    <input type="text" value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })}
                                        placeholder="주문번호" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">요청 사유</label>
                                    <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                                        placeholder="예: 사이즈 불량" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="col-span-2 md:col-span-3">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">내부 메모</label>
                                    <input type="text" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
                                        placeholder="처리 시 참고사항" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="col-span-2 md:col-span-3 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowForm(false)}
                                        className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">취소</button>
                                    <button type="submit" disabled={isSaving}
                                        className="px-7 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all disabled:bg-slate-400">
                                        {isSaving ? '등록 중...' : 'CS 접수 등록'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* 타입 필터 */}
                    <div className="flex gap-2">
                        {['전체', '반품', '교환'].map(t => (
                            <button key={t} onClick={() => setFilterType(t)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterType === t ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* CS 목록 테이블 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase tracking-wide">
                                    <tr>
                                        <th className="px-4 py-3 text-left">상태</th>
                                        <th className="px-4 py-3 text-left">유형</th>
                                        <th className="px-4 py-3 text-left">플랫폼</th>
                                        <th className="px-4 py-3 text-left">고객명</th>
                                        <th className="px-4 py-3 text-left hidden md:table-cell">주문번호</th>
                                        <th className="px-4 py-3 text-left hidden lg:table-cell">사유</th>
                                        <th className="px-4 py-3 text-center hidden md:table-cell">운송장</th>
                                        <th className="px-4 py-3 text-left">접수일</th>
                                        <th className="px-4 py-3 text-center">변경</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-12 text-slate-400">접수된 CS가 없습니다</td></tr>
                                    ) : filtered.map(req => {
                                        const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                                        const isBlacklisted = blacklistNames.has(req.customer_name);
                                        return (
                                            <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg?.color || ''}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot || ''}`} />
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${req.request_type === '반품' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                                                        {req.request_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-sm text-slate-700 font-medium">{req.platform}</td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm text-slate-800 font-semibold">{req.customer_name}</span>
                                                        {isBlacklisted && (
                                                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">블랙</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs font-mono text-slate-500 hidden md:table-cell">{req.order_number || '-'}</td>
                                                <td className="px-4 py-3.5 text-xs text-slate-500 hidden lg:table-cell truncate max-w-[120px]">{req.reason || '-'}</td>
                                                <td className="px-4 py-3.5 text-center hidden md:table-cell">
                                                    <button onClick={() => openTracking(req)}
                                                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${req.tracking_number ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        {req.tracking_number ? `📦 ${req.carrier?.slice(0, 4)}` : '+ 입력'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                                                    {new Date(req.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <select value={req.status} onChange={e => handleStatusChange(req.id, e.target.value)}
                                                        title="상태 변경"
                                                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
                                                        <option>신규</option>
                                                        <option>처리중</option>
                                                        <option>완료</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ── 채널별 현황 탭 ── */}
            {tab === 'stats' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-5 py-3 text-left">플랫폼</th>
                                    <th className="px-5 py-3 text-right">전체</th>
                                    <th className="px-5 py-3 text-right">처리 대기</th>
                                    <th className="px-5 py-3 text-right">반품</th>
                                    <th className="px-5 py-3 text-right">교환</th>
                                    <th className="px-5 py-3 text-right">완료율</th>
                                </tr>
                            </thead>
                            <tbody>
                                {channelStats.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">데이터가 없습니다</td></tr>
                                ) : channelStats.map(s => (
                                    <tr key={s.platform} className="border-b border-slate-50">
                                        <td className="px-5 py-3.5 font-semibold text-slate-800">{s.platform}</td>
                                        <td className="px-5 py-3.5 text-right text-slate-700">{s.total}건</td>
                                        <td className={`px-5 py-3.5 text-right font-semibold ${s.pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.pending}건</td>
                                        <td className="px-5 py-3.5 text-right text-red-600">{s.returns}건</td>
                                        <td className="px-5 py-3.5 text-right text-purple-600">{s.exchanges}건</td>
                                        <td className="px-5 py-3.5 text-right text-slate-600">
                                            {s.total > 0 ? Math.round(((s.total - s.pending) / s.total) * 100) : 0}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── 블랙리스트 탭 ── */}
            {tab === 'blacklist' && (
                <div className="space-y-4">
                    {/* 등록 폼 */}
                    <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">🚫 블랙리스트 등록</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <input type="text" value={blForm.customer_name} onChange={e => setBlForm({ ...blForm, customer_name: e.target.value })}
                                placeholder="고객명 *" className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-400" />
                            <select value={blForm.platform} onChange={e => setBlForm({ ...blForm, platform: e.target.value })}
                                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-400">
                                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                            </select>
                            <input type="text" value={blForm.reason} onChange={e => setBlForm({ ...blForm, reason: e.target.value })}
                                placeholder="등록 사유 *" className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-400" />
                            <button onClick={handleBlacklistAdd}
                                className="py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all">
                                블랙리스트 등록
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-5 py-3 text-left">고객명</th>
                                    <th className="px-5 py-3 text-left">플랫폼</th>
                                    <th className="px-5 py-3 text-left">등록 사유</th>
                                    <th className="px-5 py-3 text-center">삭제</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blacklist.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-slate-400">블랙리스트가 없습니다</td></tr>
                                ) : blacklist.map(b => (
                                    <tr key={b.id} className="border-b border-slate-50">
                                        <td className="px-5 py-3.5 font-semibold text-red-700">{b.customer_name}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{b.platform || '-'}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{b.reason}</td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button onClick={() => handleBlacklistRemove(b.id)}
                                                className="text-xs px-3 py-1 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-lg transition-all">
                                                제거
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── 운송장 입력 모달 ── */}
            {selectedReq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-slate-800">📦 배송 정보 입력</h3>
                            <button onClick={() => setSelectedReq(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{selectedReq.customer_name} · {selectedReq.request_type} · {selectedReq.platform}</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">택배사</label>
                                <select value={trackingForm.carrier} onChange={e => setTrackingForm(p => ({ ...p, carrier: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                    {CARRIERS.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">운송장 번호</label>
                                <input type="text" value={trackingForm.tracking_number}
                                    onChange={e => setTrackingForm(p => ({ ...p, tracking_number: e.target.value }))}
                                    placeholder="운송장 번호 입력"
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            {selectedReq.request_type === '교환' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">교환 요청 상품</label>
                                    <input type="text" value={trackingForm.exchange_item}
                                        onChange={e => setTrackingForm(p => ({ ...p, exchange_item: e.target.value }))}
                                        placeholder="예: 블랙 M사이즈"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            )}
                            {selectedReq.request_type === '반품' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">환불 금액 (원)</label>
                                    <input type="number" value={trackingForm.refund_amount}
                                        onChange={e => setTrackingForm(p => ({ ...p, refund_amount: Number(e.target.value) }))}
                                        placeholder="0"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setSelectedReq(null)}
                                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl">취소</button>
                            <button onClick={handleTrackingSave}
                                className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all">
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
