"use client";

import React, { useState } from 'react';

const PLATFORMS = ['무신사', '29CM', '카페24', 'W컨셉', '자사몰', '기타'];
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
    created_at: string;
    resolved_at: string | null;
};

type NewForm = {
    platform: string;
    order_number: string;
    customer_name: string;
    request_type: '반품' | '교환';
    reason: string;
    assignee: string;
    memo: string;
};

export default function CsTrackerClient({ initialRequests }: { initialRequests: CsRequest[] }) {
    const [requests, setRequests] = useState<CsRequest[]>(initialRequests);
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('전체');
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<NewForm>({
        platform: '무신사', order_number: '', customer_name: '',
        request_type: '반품', reason: '', assignee: '', memo: '',
    });

    const filteredRequests = filterStatus === '전체'
        ? requests
        : requests.filter(r => r.status === filterStatus);

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

    return (
        <div className="space-y-6">
            {/* 상단 요약 카드 */}
            <div className="grid grid-cols-4 gap-4">
                {(['전체', '신규', '처리중', '완료'] as const).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`rounded-xl p-4 text-left transition-all ${filterStatus === s ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-sm'}`}
                        style={{ background: 'white', border: '1px solid #f1f5f9' }}>
                        <p className="text-xs text-slate-500 mb-1">{s}</p>
                        <p className={`text-2xl font-black ${s === '신규' ? 'text-amber-500' : s === '처리중' ? 'text-blue-500' : s === '완료' ? 'text-emerald-500' : 'text-slate-800'}`}>
                            {counts[s]}
                        </p>
                    </button>
                ))}
            </div>

            {/* 헤더 액션 */}
            <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{filterStatus} · {filteredRequests.length}건</p>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    CS 접수 등록
                </button>
            </div>

            {/* 등록 폼 */}
            {showForm && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">📋 새 CS 접수 등록</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">플랫폼</label>
                            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
                                title="플랫폼 선택"
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
                                placeholder="홍길동" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">주문번호</label>
                            <input type="text" value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })}
                                placeholder="주문번호 입력" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">요청 사유</label>
                            <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                                placeholder="예: 사이즈 불량, 단순 변심" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">내부 메모 (선택)</label>
                            <input type="text" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
                                placeholder="처리 시 참고사항" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="col-span-2 md:col-span-3 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">취소</button>
                            <button type="submit" disabled={isSaving}
                                className="px-7 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-slate-400">
                                {isSaving ? '등록 중...' : 'CS 접수 등록'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* CS 목록 */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase tracking-wide">
                            <tr>
                                <th className="px-5 py-3 text-left">상태</th>
                                <th className="px-5 py-3 text-left">유형</th>
                                <th className="px-5 py-3 text-left">플랫폼</th>
                                <th className="px-5 py-3 text-left">고객명</th>
                                <th className="px-5 py-3 text-left hidden md:table-cell">주문번호</th>
                                <th className="px-5 py-3 text-left hidden lg:table-cell">사유</th>
                                <th className="px-5 py-3 text-left hidden md:table-cell">담당자</th>
                                <th className="px-5 py-3 text-left">접수일</th>
                                <th className="px-5 py-3 text-center">변경</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-12 text-slate-400">접수된 CS가 없습니다</td></tr>
                            ) : (
                                filteredRequests.map(req => {
                                    const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                                    return (
                                        <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${req.request_type === '반품' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {req.request_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-slate-700 font-medium">{req.platform}</td>
                                            <td className="px-5 py-3.5 text-sm text-slate-800 font-semibold">{req.customer_name}</td>
                                            <td className="px-5 py-3.5 text-xs font-mono text-slate-500 hidden md:table-cell">{req.order_number || '-'}</td>
                                            <td className="px-5 py-3.5 text-xs text-slate-500 hidden lg:table-cell truncate max-w-[140px]">{req.reason || '-'}</td>
                                            <td className="px-5 py-3.5 text-xs text-slate-500 hidden md:table-cell">{req.assignee || '-'}</td>
                                            <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                                                {new Date(req.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <select value={req.status}
                                                    onChange={e => handleStatusChange(req.id, e.target.value)}
                                                    title="상태 변경"
                                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                                                    <option>신규</option>
                                                    <option>처리중</option>
                                                    <option>완료</option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
