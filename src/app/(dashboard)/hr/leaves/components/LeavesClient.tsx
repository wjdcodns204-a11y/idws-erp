"use client";

import React, { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-client';

type LeaveType = {
    id: string;
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    employee?: { name: string, department: string };
};

export default function LeavesClient({ initialLeaves }: { initialLeaves: LeaveType[] }) {
    const [leaves, setLeaves] = useState<LeaveType[]>(initialLeaves);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [newLeave, setNewLeave] = useState({
        type: '연차',
        startDate: '',
        endDate: '',
        reason: ''
    });

    const handleApplyLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLeave.startDate || !newLeave.endDate) return alert("휴가 시작일과 종료일을 선택해 주세요.");
        if (new Date(newLeave.endDate) < new Date(newLeave.startDate)) return alert("종료일이 시작일보다 빠를 수 없습니다.");

        setIsSubmitting(true);
        try {
            const supabase = createSupabaseBrowser();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("로그인 유저 정보가 없습니다. 다시 로그인 해주세요.");

            const { data: emp, error: empError } = await supabase.from('employees').select('id, name, department').eq('email', user.email).single();
            if (empError || !emp) throw new Error("현재 로그인된 계정에 매핑된 직원 정보가 없습니다.");

            // 간단한 기간 로직 (주말/공휴일 제외 로직은 추후 고도화 필요)
            const start = new Date(newLeave.startDate);
            const end = new Date(newLeave.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const duration = newLeave.type === '반차' ? 0.5 : diffDays;

            const { data: insertedLeave, error } = await supabase.from('leaves').insert({
                employee_id: emp.id,
                type: newLeave.type,
                start_date: newLeave.startDate,
                end_date: newLeave.endDate,
                duration_days: duration,
                reason: newLeave.reason,
                status: '승인대기'
            }).select('*, employee:employees!leaves_employee_id_fkey(name, department)').single();

            if (error) throw error;
            if (insertedLeave) {
                // UI 즉시 업데이트
                setLeaves([insertedLeave, ...leaves]);
                // 모달 닫기 & 폼 초기화
                setIsModalOpen(false);
                setNewLeave({ type: '연차', startDate: '', endDate: '', reason: '' });
                alert("휴가 신청이 성공적으로 완료되었습니다! 🎉");
            }
        } catch (error: unknown) {
            alert("휴가 신청 중 오류가 발생했습니다: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
                <h2 className="text-lg font-semibold text-slate-800 mb-6">휴가 신청 내역</h2>

                {leaves && leaves.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-medium">신청자</th>
                                    <th className="px-4 py-3 font-medium">종류</th>
                                    <th className="px-4 py-3 font-medium">기간</th>
                                    <th className="px-4 py-3 font-medium">사유</th>
                                    <th className="px-4 py-3 font-medium">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leaves.map((leave) => (
                                    <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-900 border-l-2 border-transparent hover:border-indigo-500">
                                            {leave.employee?.name || '-'}
                                            <span className="ml-2 text-xs text-slate-500 font-normal">{leave.employee?.department}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 font-medium">{leave.type}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{leave.start_date} ~ {leave.end_date}</td>
                                        <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={leave.reason}>{leave.reason || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${leave.status === '승인됨' ? 'bg-emerald-100 text-emerald-700' :
                                                leave.status === '반려됨' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {leave.status || '승인대기'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-sm">
                        신청된 휴가 내역이 없습니다.
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
                <h2 className="text-lg font-semibold text-slate-800 mb-6">나의 남은 연차</h2>
                <div className="flex-1 flex flex-col items-center justify-center h-32 text-indigo-600 text-4xl font-bold bg-indigo-50/50 rounded-lg border border-indigo-100">
                    15 <span className="text-lg text-slate-500 font-normal ml-2 mt-1">일</span>
                    <p className="text-xs text-slate-400 font-normal mt-2">올해 발생 연차: 15일</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full mt-6 bg-slate-900 hover:bg-black text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
                >
                    휴가 신청하기
                </button>
            </div>

            {/* 휴가 신청 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">휴가 신청서</h2>
                            <button onClick={() => setIsModalOpen(false)} title="닫기" className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleApplyLeave} className="flex flex-col">
                            <div className="p-6 space-y-4">
                                <div>
                                    <label htmlFor="leave_type" className="block text-sm font-medium text-slate-700 mb-1">휴가 종류</label>
                                    <select
                                        id="leave_type"
                                        title="휴가 종류"
                                        value={newLeave.type}
                                        onChange={e => setNewLeave({ ...newLeave, type: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="연차">연차</option>
                                        <option value="반차">반차(오전/오후)</option>
                                        <option value="병가">병가</option>
                                        <option value="공가">공가</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="start_date" className="block text-sm font-medium text-slate-700 mb-1">시작일</label>
                                        <input
                                            id="start_date"
                                            title="시작일"
                                            type="date"
                                            required
                                            value={newLeave.startDate}
                                            onChange={e => setNewLeave({ ...newLeave, startDate: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="end_date" className="block text-sm font-medium text-slate-700 mb-1">종료일</label>
                                        <input
                                            id="end_date"
                                            title="종료일"
                                            type="date"
                                            required
                                            value={newLeave.endDate}
                                            onChange={e => setNewLeave({ ...newLeave, endDate: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <label htmlFor="leave_reason" className="block text-sm font-medium text-slate-700 mb-1">사유</label>
                                    <textarea
                                        id="leave_reason"
                                        title="사유"
                                        rows={3}
                                        value={newLeave.reason}
                                        onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="휴가 사유를 작성해 주세요."
                                    ></textarea>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-50 cursor-pointer">
                                    취소
                                </button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-white bg-indigo-600 rounded-lg font-medium hover:bg-indigo-700 cursor-pointer disabled:opacity-50">
                                    {isSubmitting ? '신청 중...' : '신청서 제출'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
