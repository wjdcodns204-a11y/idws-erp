"use client";

import React, { useState } from 'react';

type Employee = {
    id: string;
    name: string;
    department: string;
    annual_leave_total: number;
    annual_leave_used: number;
    role: string;
};

type LeaveRequest = {
    id: string;
    employee_id: string;
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    employee?: Employee;
};

export default function LeaveDashboardClient({
    currentUser,
    myRequests,
    allPendingRequests
}: {
    currentUser: Employee,
    myRequests: LeaveRequest[],
    allPendingRequests: LeaveRequest[]
}) {
    const isAdmin = currentUser.role === 'master';
    const [formType, setFormType] = useState('연차');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form logic
    const handleApplyLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) return alert('시작일과 종료일을 올바르게 입력해주세요.');

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/hr/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: currentUser.id,
                    type: formType,
                    startDate,
                    endDate,
                    reason
                })
            });

            if (res.ok) {
                alert('휴가 신청이 완료되었습니다. 대표님의 승인을 기다려주세요.');
                window.location.reload();
            } else {
                const data = await res.json();
                alert(`신청 실패: ${data.error}`);
            }
        } catch (error: any) {
            alert(`오류 발생: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Admin logic
    const handleAction = async (requestId: string, action: 'approved' | 'rejected') => {
        if (!confirm(`이 휴가를 ${action === 'approved' ? '승인' : '반려'} 처리하시겠습니까?`)) return;

        try {
            const res = await fetch('/api/hr/leave/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, newStatus: action })
            });
            if (res.ok) {
                alert('처리가 완료되었습니다.');
                window.location.reload();
            } else {
                const data = await res.json();
                alert(`처리 실패: ${data.error}`);
            }
        } catch (error: any) {
            alert(`오류 발생: ${error.message}`);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / Annual Leave Intro */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">휴가 / 연차 결재 시스템</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        근속 1년 미만은 12일, 1년 이상은 15일의 기본 연차가 부여됩니다.
                    </p>
                </div>
                {!isAdmin && (
                    <div className="text-right">
                        <div className="text-xs text-slate-500 font-medium">나의 잔여 연차</div>
                        <div className="text-3xl font-bold text-indigo-600">
                            {currentUser.annual_leave_total - currentUser.annual_leave_used} <span className="text-sm text-slate-600">/ {currentUser.annual_leave_total}일</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Apply Form (Left) */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">새 휴가 신청서 작성</h3>
                    <form onSubmit={handleApplyLeave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">휴가 종류</label>
                            <select
                                value={formType}
                                onChange={e => setFormType(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value="연차">연차 (1일)</option>
                                <option value="반차">오전/오후 반차 (0.5일)</option>
                                <option value="병가">병가 (유/무급)</option>
                                <option value="경조사">경조사</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">시작일</label>
                                <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">종료일</label>
                                <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">사유 (선택)</label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                rows={3}
                                placeholder="개인 사정 등 간략한 사유를 적어주세요."
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-slate-400"
                        >
                            결재 올리기
                        </button>
                    </form>
                </div>

                {/* Lists (Right) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Admin Only - Pending Requests */}
                    {isAdmin && (
                        <div className="bg-red-50/50 rounded-xl shadow-sm border border-red-100 p-6">
                            <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                                <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                결재 대기 중인 신청 건 ({allPendingRequests.length}건)
                            </h3>
                            {allPendingRequests.length === 0 ? (
                                <p className="text-sm text-red-400 text-center py-4 bg-white/50 rounded-lg border border-red-100/50">현재 결재 대기 중인 휴가가 없습니다.</p>
                            ) : (
                                <div className="space-y-3">
                                    {allPendingRequests.map(req => (
                                        <div key={req.id} className="bg-white p-4 rounded-lg border border-red-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-800">{req.employee?.name}</span>
                                                    <span className="text-xs text-slate-500">{req.employee?.department}</span>
                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">{req.type}</span>
                                                </div>
                                                <div className="text-sm text-slate-600 font-medium">
                                                    {req.start_date} ~ {req.end_date}
                                                    {req.reason && <span className="text-slate-400 ml-2 font-normal">| {req.reason}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <button onClick={() => handleAction(req.id, 'rejected')} className="flex-1 md:flex-none text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors">반려</button>
                                                <button onClick={() => handleAction(req.id, 'approved')} className="flex-1 md:flex-none text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors">승인하기</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* My Requests History */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">나의 휴가 신청 내역</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 border-y border-slate-100 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">종류</th>
                                        <th className="px-4 py-3 font-semibold">기간</th>
                                        <th className="px-4 py-3 font-semibold">사유</th>
                                        <th className="px-4 py-3 font-semibold">신청일</th>
                                        <th className="px-4 py-3 font-semibold text-right">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {myRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-medium text-slate-700">{req.type}</td>
                                            <td className="px-4 py-3 text-slate-600">{req.start_date} ~ {req.end_date}</td>
                                            <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]">{req.reason || '-'}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{new Date(req.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                            'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {req.status === 'approved' ? '승인완료' : req.status === 'rejected' ? '반려됨' : '대기중'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {myRequests.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-400">신청 내역이 없습니다.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
