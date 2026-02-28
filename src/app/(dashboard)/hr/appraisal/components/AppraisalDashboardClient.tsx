"use client";

import React, { useState } from 'react';

type AppraisalData = {
    score_achievement: number;
    score_communication: number;
    score_problem_solving: number;
    feedback_text: string;
    period: string;
};

type Employee = { id: string; name: string; department: string; };

function StarRating({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    onClick={() => !disabled && onChange(star)}
                    className={`text-2xl transition-all ${star <= value ? 'text-amber-400' : 'text-slate-200'
                        } ${!disabled ? 'hover:text-amber-300 active:scale-110 cursor-pointer' : 'cursor-default'}`}
                >
                    ★
                </button>
            ))}
            <span className="text-sm text-slate-500 ml-1 self-center">{value > 0 ? `${value}.0` : '-'}</span>
        </div>
    );
}

export default function AppraisalDashboardClient({ employees }: { employees: Employee[] }) {
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [period, setPeriod] = useState(`${new Date().getFullYear()}-1H`);

    const [form, setForm] = useState<AppraisalData>({
        score_achievement: 0,
        score_communication: 0,
        score_problem_solving: 0,
        feedback_text: '',
        period: period,
    });
    const [isSaving, setIsSaving] = useState(false);

    const avgScore = selectedEmp
        ? ((form.score_achievement + form.score_communication + form.score_problem_solving) / 3).toFixed(1)
        : '-';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp) return;
        setIsSaving(true);

        try {
            const res = await fetch('/api/hr/appraisal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ evaluateeId: selectedEmp.id, ...form, period })
            });

            if (res.ok) {
                alert(`${selectedEmp.name}님의 ${period} 평가가 저장되었습니다!`);
            } else {
                const data = await res.json();
                alert(`오류: ${data.error}`);
            }
        } catch (err: any) {
            alert(`오류: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Employee list */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-4 h-fit">
                <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">평가 대상 직원</h3>
                <div className="space-y-1">
                    {employees.map(emp => (
                        <button key={emp.id} onClick={() => {
                            setSelectedEmp(emp);
                            setForm({ score_achievement: 0, score_communication: 0, score_problem_solving: 0, feedback_text: '', period });
                        }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${selectedEmp?.id === emp.id ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">{emp.name.charAt(0)}</div>
                            <div>
                                <div className="text-sm font-semibold">{emp.name}</div>
                                <div className="text-xs text-slate-400">{emp.department}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Appraisal Form */}
            <div className="lg:col-span-3">
                {!selectedEmp ? (
                    <div className="bg-slate-50 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px] border border-slate-100">
                        <span className="text-5xl mb-3">📋</span>
                        <p>좌측에서 평가할 직원을 선택해주세요</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{selectedEmp.name}님 성과 평가</h2>
                                <p className="text-slate-500 text-sm mt-0.5">{selectedEmp.department}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-400 mb-1">종합 평균 점수</div>
                                <div className="text-3xl font-black text-indigo-600">{avgScore}<span className="text-sm text-slate-500 font-normal"> / 5.0</span></div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-7">
                            {/* Period selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">평가 기간</label>
                                <select
                                    value={period}
                                    onChange={e => setPeriod(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {[2025, 2026, 2027].flatMap(y => [
                                        <option key={`${y}-1H`} value={`${y}-1H`}>{y}년 상반기</option>,
                                        <option key={`${y}-2H`} value={`${y}-2H`}>{y}년 하반기</option>,
                                    ])}
                                </select>
                            </div>

                            <div className="space-y-6 p-6 bg-slate-50/50 rounded-xl border border-slate-100">
                                {/* 항목별 평가 */}
                                {[
                                    { key: 'score_achievement', label: '업무 달성도', desc: '주어진 목표 및 KPI를 얼마나 달성했는가?' },
                                    { key: 'score_communication', label: '커뮤니케이션', desc: '팀 협업, 보고, 소통 능력은 어땠는가?' },
                                    { key: 'score_problem_solving', label: '문제 해결력', desc: '어려운 상황에서 스스로 해결책을 도출했는가?' },
                                ].map(item => (
                                    <div key={item.key} className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-700">{item.label}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                                        </div>
                                        <StarRating
                                            value={form[item.key as keyof AppraisalData] as number}
                                            onChange={v => setForm({ ...form, [item.key]: v })}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">종합 의견 (선택)</label>
                                <textarea
                                    rows={4}
                                    value={form.feedback_text}
                                    onChange={e => setForm({ ...form, feedback_text: e.target.value })}
                                    placeholder="이번 평가 기간 동안의 전반적인 의견이나 개선 제안 사항을 자유롭게 작성해주세요."
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:bg-slate-400">
                                {isSaving ? '저장 중...' : '평가 결과 저장'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
