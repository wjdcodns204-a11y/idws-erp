'use client';

import { useState } from 'react';

type Employee = { id: string; name: string; department: string; position: string; join_date: string };
type Payroll = {
    id: string; employee_id: string; year_month: string;
    base_salary: number; performance_bonus: number; overtime_pay: number;
    meal_allowance: number; transport_allowance: number;
    gross_pay: number; national_pension: number; health_insurance: number;
    long_term_care: number; employment_insurance: number;
    income_tax: number; local_income_tax: number; net_pay: number;
    paid_at: string | null; memo: string;
    employees: { name: string; department: string; position: string };
};
type LeaveBalance = {
    id: string; employee_id: string; year: number;
    total_days: number; used_days: number; remaining_days: number;
    employees: { name: string; department: string; join_date: string };
};
type Interview = {
    id: string; employee_id: string; interview_date: string;
    type: string; content: string; action_items: string;
    employees: { name: string; department: string };
};

type Tab = 'payroll' | 'leave' | 'interview';

function formatKRW(v: number) {
    return v.toLocaleString() + '원';
}

function calcLeaveYears(joinDate: string): number {
    const join = new Date(joinDate);
    const now = new Date();
    return Math.floor((now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24 * 365));
}

export default function PayrollClient({
    employees, initialPayrolls, initialLeaveBalances, initialInterviews, currentMonth, currentYear,
}: {
    employees: Employee[];
    initialPayrolls: Payroll[];
    initialLeaveBalances: LeaveBalance[];
    initialInterviews: Interview[];
    currentMonth: string;
    currentYear: number;
}) {
    const [tab, setTab] = useState<Tab>('payroll');
    const [month, setMonth] = useState(currentMonth);
    const [payrolls, setPayrolls] = useState<Payroll[]>(initialPayrolls);
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>(initialLeaveBalances);
    const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
    const [saving, setSaving] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);

    // 급여 입력 폼
    const [payForm, setPayForm] = useState({
        employee_id: '', base_salary: 0, performance_bonus: 0, overtime_pay: 0,
        meal_allowance: 30000, transport_allowance: 0, income_tax: 0, memo: '', paid_at: '',
    });

    // 면담 폼
    const [interviewForm, setInterviewForm] = useState({
        employee_id: '', interview_date: new Date().toISOString().slice(0, 10),
        type: '정기면담', content: '', action_items: '', next_date: '',
    });

    // 급여 저장
    const handlePayrollSave = async () => {
        if (!payForm.employee_id || payForm.base_salary <= 0) return alert('직원과 기본급을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/hr/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payForm, year_month: month }),
        });
        if (res.ok) {
            const data = await res.json();
            setPayrolls(prev => {
                const idx = prev.findIndex(p => p.employee_id === data.employee_id);
                return idx >= 0 ? prev.map((p, i) => i === idx ? data : p) : [...prev, data];
            });
            setPayForm({ employee_id: '', base_salary: 0, performance_bonus: 0, overtime_pay: 0, meal_allowance: 30000, transport_allowance: 0, income_tax: 0, memo: '', paid_at: '' });
        }
        setSaving(false);
    };

    // 연차 자동 생성
    const handleLeaveInit = async (empId: string) => {
        const res = await fetch('/api/hr/annual-leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: empId, year: currentYear }),
        });
        if (res.ok) {
            const data = await res.json();
            setLeaveBalances(prev => {
                const idx = prev.findIndex(l => l.employee_id === empId);
                return idx >= 0 ? prev.map((l, i) => i === idx ? data : l) : [...prev, data];
            });
        }
    };

    // 연차 사용일수 업데이트
    const handleLeaveUpdate = async (id: string, empId: string, usedDays: number) => {
        const existing = leaveBalances.find(l => l.id === id);
        if (!existing) return;
        const res = await fetch('/api/hr/annual-leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: empId, year: currentYear, total_days: existing.total_days, used_days: usedDays }),
        });
        if (res.ok) {
            const data = await res.json();
            setLeaveBalances(prev => prev.map(l => l.id === id ? data : l));
        }
    };

    // 면담 저장
    const handleInterviewSave = async () => {
        if (!interviewForm.employee_id || !interviewForm.content.trim()) return alert('직원과 면담 내용을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/hr/interviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(interviewForm),
        });
        if (res.ok) {
            const data = await res.json();
            setInterviews(prev => [data, ...prev]);
            setInterviewForm({ employee_id: '', interview_date: new Date().toISOString().slice(0, 10), type: '정기면담', content: '', action_items: '', next_date: '' });
        }
        setSaving(false);
    };

    // 예상 급여 미리보기 계산
    const preview = {
        gross: payForm.base_salary + payForm.performance_bonus + payForm.overtime_pay + payForm.meal_allowance + payForm.transport_allowance,
        pension: Math.round(payForm.base_salary * 0.045),
        health: Math.round(payForm.base_salary * 0.03545),
        longCare: Math.round(payForm.base_salary * 0.03545 * 0.1295),
        employment: Math.round(payForm.base_salary * 0.009),
    };
    const totalDeduction = preview.pension + preview.health + preview.longCare + preview.employment + payForm.income_tax + Math.round(payForm.income_tax * 0.1);
    const netPreview = preview.gross - totalDeduction;

    // 월별 급여 합계
    const totalGross = payrolls.reduce((s, p) => s + (p.gross_pay || 0), 0);
    const totalNet = payrolls.reduce((s, p) => s + (p.net_pay || 0), 0);

    // 연차 다음에 올 직원 (아직 연차 없는 직원)
    const employeesWithoutLeave = employees.filter(e => !leaveBalances.find(l => l.employee_id === e.id));

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">급여·연차·면담 관리</h1>
                    <p className="text-sm text-slate-500 mt-1">급여 명세서 생성, 4대보험 자동 계산, 연차/면담을 관리합니다.</p>
                </div>
                {tab === 'payroll' && (
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                        className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold" />
                )}
            </div>

            {/* 급여 요약 */}
            {tab === 'payroll' && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: '총 인원', value: `${payrolls.length}명`, color: 'text-slate-800' },
                        { label: '총 지급액(세전)', value: formatKRW(totalGross), color: 'text-indigo-700' },
                        { label: '총 실수령액', value: formatKRW(totalNet), color: 'text-emerald-700' },
                    ].map(c => (
                        <div key={c.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* 탭 */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {([['payroll', '💰 급여 명세'], ['leave', '🌴 연차 현황'], ['interview', '💬 면담 기록']] as [Tab, string][]).map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── 급여 명세 탭 ── */}
            {tab === 'payroll' && (
                <div className="space-y-4">
                    {/* 급여 입력 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">💰 급여 입력 / 수정</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="col-span-2 sm:col-span-4">
                                <label className="block text-xs font-bold text-slate-500 mb-1">직원 선택</label>
                                <select value={payForm.employee_id} onChange={e => setPayForm(prev => ({ ...prev, employee_id: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="">직원 선택</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                                </select>
                            </div>
                            {[
                                { label: '기본급', key: 'base_salary' },
                                { label: '성과급', key: 'performance_bonus' },
                                { label: '시간외수당', key: 'overtime_pay' },
                                { label: '식대(비과세)', key: 'meal_allowance' },
                                { label: '교통비', key: 'transport_allowance' },
                                { label: '소득세', key: 'income_tax' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">{field.label}</label>
                                    <input type="number" value={(payForm as never)[field.key] || ''}
                                        onChange={e => setPayForm(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            ))}
                        </div>

                        {/* 미리보기 */}
                        {payForm.base_salary > 0 && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm space-y-1.5">
                                <p className="font-bold text-slate-700 mb-2">📋 급여 미리보기</p>
                                <div className="grid grid-cols-2 gap-x-8 text-xs">
                                    <div className="space-y-1">
                                        <div className="flex justify-between"><span className="text-slate-500">세전 총합</span><span className="font-semibold">{formatKRW(preview.gross)}</span></div>
                                        <div className="flex justify-between text-orange-600"><span>국민연금 (4.5%)</span><span>-{formatKRW(preview.pension)}</span></div>
                                        <div className="flex justify-between text-orange-600"><span>건강보험 (3.545%)</span><span>-{formatKRW(preview.health)}</span></div>
                                        <div className="flex justify-between text-orange-600"><span>장기요양 (12.95%)</span><span>-{formatKRW(preview.longCare)}</span></div>
                                        <div className="flex justify-between text-orange-600"><span>고용보험 (0.9%)</span><span>-{formatKRW(preview.employment)}</span></div>
                                        <div className="flex justify-between text-red-600"><span>소득세+지방세</span><span>-{formatKRW(payForm.income_tax + Math.round(payForm.income_tax * 0.1))}</span></div>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <div className="text-center">
                                            <p className="text-xs text-slate-500">실수령액</p>
                                            <p className="text-2xl font-black text-emerald-700">{formatKRW(netPreview)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button onClick={handlePayrollSave} disabled={saving}
                            className="mt-4 w-full py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:bg-slate-300">
                            {saving ? '저장 중...' : '급여 저장'}
                        </button>
                    </div>

                    {/* 급여 목록 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">직원</th>
                                    <th className="px-4 py-3 text-right">기본급</th>
                                    <th className="px-4 py-3 text-right hidden sm:table-cell">세전합계</th>
                                    <th className="px-4 py-3 text-right hidden sm:table-cell">공제합계</th>
                                    <th className="px-4 py-3 text-right">실수령액</th>
                                    <th className="px-4 py-3 text-center">상세</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrolls.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">급여 데이터가 없습니다</td></tr>
                                ) : payrolls.map(p => (
                                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => setSelectedPayroll(selectedPayroll?.id === p.id ? null : p)}>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800">{p.employees?.name}</p>
                                            <p className="text-xs text-slate-400">{p.employees?.department} · {p.employees?.position}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatKRW(p.base_salary)}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">{formatKRW(p.gross_pay)}</td>
                                        <td className="px-4 py-3 text-right text-orange-600 hidden sm:table-cell">
                                            -{formatKRW(p.national_pension + p.health_insurance + p.long_term_care + p.employment_insurance + p.income_tax + p.local_income_tax)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatKRW(p.net_pay)}</td>
                                        <td className="px-4 py-3 text-center text-indigo-500 text-xs">▼</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 급여 상세 */}
                    {selectedPayroll && (
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                            <div className="flex justify-between mb-4">
                                <h3 className="font-bold text-slate-800">{selectedPayroll.employees?.name} — {selectedPayroll.year_month} 급여 상세</h3>
                                <button onClick={() => setSelectedPayroll(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>
                            <div className="grid grid-cols-2 gap-8 text-sm">
                                <div className="space-y-2">
                                    <p className="font-bold text-slate-700 text-xs uppercase mb-2">지급 항목</p>
                                    {[
                                        ['기본급', selectedPayroll.base_salary],
                                        ['성과급', selectedPayroll.performance_bonus],
                                        ['시간외수당', selectedPayroll.overtime_pay],
                                        ['식대(비과세)', selectedPayroll.meal_allowance],
                                        ['교통비', selectedPayroll.transport_allowance],
                                    ].filter(([, v]) => Number(v) > 0).map(([label, v]) => (
                                        <div key={label as string} className="flex justify-between text-slate-600">
                                            <span>{label as string}</span><span>{formatKRW(Number(v))}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold border-t pt-2 text-slate-800">
                                        <span>세전 합계</span><span>{formatKRW(selectedPayroll.gross_pay)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="font-bold text-slate-700 text-xs uppercase mb-2">공제 항목</p>
                                    {[
                                        ['국민연금 (4.5%)', selectedPayroll.national_pension],
                                        ['건강보험 (3.545%)', selectedPayroll.health_insurance],
                                        ['장기요양보험', selectedPayroll.long_term_care],
                                        ['고용보험 (0.9%)', selectedPayroll.employment_insurance],
                                        ['소득세', selectedPayroll.income_tax],
                                        ['지방소득세', selectedPayroll.local_income_tax],
                                    ].map(([label, v]) => (
                                        <div key={label as string} className="flex justify-between text-orange-600">
                                            <span className="text-slate-500">{label as string}</span><span>-{formatKRW(Number(v))}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-black border-t pt-2 text-emerald-700 text-base">
                                        <span>실수령액</span><span>{formatKRW(selectedPayroll.net_pay)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── 연차 현황 탭 ── */}
            {tab === 'leave' && (
                <div className="space-y-4">
                    {/* 연차 미생성 직원 자동 생성 버튼 */}
                    {employeesWithoutLeave.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-sm font-semibold text-amber-800 mb-3">
                                ⚠️ {currentYear}년 연차가 아직 없는 직원: {employeesWithoutLeave.map(e => e.name).join(', ')}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                {employeesWithoutLeave.map(e => (
                                    <button key={e.id} onClick={() => handleLeaveInit(e.id)}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg">
                                        {e.name} 연차 자동 생성
                                    </button>
                                ))}
                                <button onClick={() => employeesWithoutLeave.forEach(e => handleLeaveInit(e.id))}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg">
                                    전원 일괄 생성
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-5 py-3 text-left">직원</th>
                                    <th className="px-5 py-3 text-right">근속연수</th>
                                    <th className="px-5 py-3 text-right">발생 연차</th>
                                    <th className="px-5 py-3 text-right">사용 연차</th>
                                    <th className="px-5 py-3 text-right">잔여 연차</th>
                                    <th className="px-5 py-3 text-center">사용일 수정</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaveBalances.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">연차 데이터가 없습니다. 위에서 자동 생성해주세요.</td></tr>
                                ) : leaveBalances.map(l => {
                                    const years = calcLeaveYears(l.employees?.join_date || '');
                                    return (
                                        <tr key={l.id} className="border-b border-slate-50">
                                            <td className="px-5 py-3">
                                                <p className="font-semibold text-slate-800">{l.employees?.name}</p>
                                                <p className="text-xs text-slate-400">{l.employees?.department}</p>
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-500">{years}년 {Math.floor((calcLeaveYears(l.employees?.join_date || '') * 12) % 12)}개월</td>
                                            <td className="px-5 py-3 text-right font-semibold text-slate-700">{l.total_days}일</td>
                                            <td className="px-5 py-3 text-right text-amber-600">{l.used_days}일</td>
                                            <td className={`px-5 py-3 text-right font-bold ${l.remaining_days <= 3 ? 'text-red-600' : 'text-emerald-700'}`}>
                                                {l.remaining_days}일
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <input type="number" defaultValue={l.used_days} min={0} max={l.total_days} step={0.5}
                                                    onBlur={e => {
                                                        const val = Number(e.target.value);
                                                        if (val !== l.used_days) handleLeaveUpdate(l.id, l.employee_id, val);
                                                    }}
                                                    className="w-16 text-center border border-slate-200 rounded-lg px-1 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── 면담 기록 탭 ── */}
            {tab === 'interview' && (
                <div className="space-y-4">
                    {/* 면담 입력 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">💬 면담 기록 추가</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">직원</label>
                                <select value={interviewForm.employee_id} onChange={e => setInterviewForm(prev => ({ ...prev, employee_id: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="">직원 선택</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">면담 유형</label>
                                <select value={interviewForm.type} onChange={e => setInterviewForm(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                    {['정기면담', '성과면담', '개선면담', '퇴직면담', '기타'].map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">면담일</label>
                                <input type="date" value={interviewForm.interview_date}
                                    onChange={e => setInterviewForm(prev => ({ ...prev, interview_date: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">다음 면담 예정일</label>
                                <input type="date" value={interviewForm.next_date}
                                    onChange={e => setInterviewForm(prev => ({ ...prev, next_date: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">면담 내용 *</label>
                                <textarea value={interviewForm.content} rows={3}
                                    onChange={e => setInterviewForm(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder="면담 주요 내용을 기록하세요"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">후속 조치</label>
                                <textarea value={interviewForm.action_items} rows={2}
                                    onChange={e => setInterviewForm(prev => ({ ...prev, action_items: e.target.value }))}
                                    placeholder="면담 후 필요한 후속 조치를 기록하세요"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                            </div>
                        </div>
                        <button onClick={handleInterviewSave} disabled={saving}
                            className="mt-4 w-full py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:bg-slate-300">
                            {saving ? '저장 중...' : '면담 기록 저장'}
                        </button>
                    </div>

                    {/* 면담 목록 */}
                    <div className="space-y-3">
                        {interviews.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">면담 기록이 없습니다</div>
                        ) : interviews.map(inv => (
                            <div key={inv.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <span className="font-bold text-slate-800">{inv.employees?.name}</span>
                                        <span className="ml-2 text-xs text-slate-400">{inv.employees?.department}</span>
                                        <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${inv.type === '개선면담' ? 'bg-red-50 text-red-600' :
                                                inv.type === '성과면담' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-slate-100 text-slate-600'
                                            }`}>{inv.type}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{inv.interview_date}</span>
                                </div>
                                <p className="text-sm text-slate-600 mt-2">{inv.content}</p>
                                {inv.action_items && (
                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500">후속 조치: <span className="font-normal text-slate-600">{inv.action_items}</span></p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
