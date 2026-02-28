"use client";

import React, { useState } from 'react';

type Employee = {
    id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    hire_date: string;
    annual_leave_total: number;
    annual_leave_used: number;
    phone_number?: string;
    birth_date?: string;
    employee_status: 'active' | 'inactive' | 'on_leave';
    base_salary?: number;
    contract_file_url?: string;
    contract_drive_link?: string;
};

export default function HrDashboardClient({ employees }: { employees: Employee[] }) {
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState<Partial<Employee>>({});
    const [isSaving, setIsSaving] = useState(false);

    // 파일 업로드 (Supabase Storage 연동 전 UI 임시 캡처용)
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleSelect = (emp: Employee) => {
        setSelectedEmp(emp);
        setFormData(emp);
        setEditMode(false);
        setSelectedFile(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp) return;
        setIsSaving(true);

        try {
            // FormData 구성 (파일이 있다면 formData로, 없으면 JSON으로)
            const payload = new FormData();
            payload.append('id', selectedEmp.id);
            payload.append('data', JSON.stringify(formData));
            if (selectedFile) {
                payload.append('file', selectedFile);
            }

            const res = await fetch('/api/hr/profile/update', {
                method: 'POST',
                body: payload
            });

            if (res.ok) {
                alert('저장되었습니다.');
                window.location.reload();
            } else {
                const data = await res.json();
                alert(`오류: ${data.error}`);
            }
        } catch (error: any) {
            alert(`저장 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* List Sidebar */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-4 h-fit flex flex-col max-h-[800px]">
                <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">조직도 ({employees.length}명)</h3>
                <div className="overflow-y-auto pr-1 space-y-1">
                    {employees.map(emp => (
                        <button
                            key={emp.id}
                            onClick={() => handleSelect(emp)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${selectedEmp?.id === emp.id
                                    ? 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${emp.employee_status === 'active' ? 'bg-emerald-400' : emp.employee_status === 'on_leave' ? 'bg-amber-400' : 'bg-red-400'}`}></div>
                                <span className="text-sm font-semibold">{emp.name}</span>
                            </div>
                            <span className="text-xs text-slate-400">{emp.department}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Profile Detail */}
            <div className="lg:col-span-3">
                {!selectedEmp ? (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-12 text-center flex flex-col items-center justify-center text-slate-400 h-full min-h-[400px]">
                        <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <p>좌측에서 직원을 선택하면 상세 인사 카드가 표시됩니다.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 lg:p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-2xl uppercase shadow-inner">
                                    {selectedEmp.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                        {selectedEmp.name}
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${selectedEmp.employee_status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                selectedEmp.employee_status === 'on_leave' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                            {selectedEmp.employee_status === 'active' ? '재직 중' : selectedEmp.employee_status === 'on_leave' ? '휴직/휴가' : '퇴사 완료'}
                                        </span>
                                    </h2>
                                    <p className="text-slate-500 text-sm mt-0.5">{selectedEmp.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (editMode) setFormData(selectedEmp); // 취소 시 롤백
                                    setEditMode(!editMode);
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editMode
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100'
                                    }`}
                            >
                                {editMode ? '수정 취소' : '인사 카드 수정'}
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="space-y-8">

                            {/* 섹션 1: 신상 및 상태 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">부서 / 직급</label>
                                    <input
                                        type="text"
                                        disabled={!editMode}
                                        value={formData.department || ''}
                                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">입사일 (연차 갱신 기준)</label>
                                    <input
                                        type="date"
                                        disabled={!editMode}
                                        value={formData.hire_date || ''}
                                        onChange={e => setFormData({ ...formData, hire_date: e.target.value })}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">연락처 (- 제외)</label>
                                    <input
                                        type="tel"
                                        disabled={!editMode}
                                        value={formData.phone_number || ''}
                                        onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                        placeholder="01012345678"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">생년월일 (생일 알림용)</label>
                                    <input
                                        type="date"
                                        disabled={!editMode}
                                        value={formData.birth_date || ''}
                                        onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">재직 상태 (퇴사 시 과거 기록 아카이빙)</label>
                                    <select
                                        disabled={!editMode}
                                        value={formData.employee_status || 'active'}
                                        onChange={e => setFormData({ ...formData, employee_status: e.target.value as any })}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
                                    >
                                        <option value="active">재직 중 (Active)</option>
                                        <option value="on_leave">휴직 중 (On Leave)</option>
                                        <option value="inactive">퇴사 완료 (Inactive/Offboarded)</option>
                                    </select>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* 섹션 2: 민감 권한 정보 (Master Only 뷰지만 이 컴포넌트 자체가 Master only임) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 bg-red-50/30 p-5 rounded-xl border border-red-50">
                                <div>
                                    <label className="block text-xs font-bold text-red-800 mb-1.5 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        연봉 / 급여 (KRW)
                                    </label>
                                    <input
                                        type="number"
                                        disabled={!editMode}
                                        value={formData.base_salary || ''}
                                        onChange={e => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                                        placeholder="예: 40000000"
                                        className="w-full bg-white border border-red-100 rounded-lg p-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-red-50/50 disabled:opacity-75 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-red-800 mb-1.5">시스템 접근 권한</label>
                                    <select
                                        disabled={!editMode}
                                        value={formData.role || 'user'}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full bg-white border border-red-100 rounded-lg p-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-red-50/50 disabled:opacity-75 disabled:cursor-not-allowed"
                                    >
                                        <option value="user">일반 직원 (User) - 본인 데이터만 열람</option>
                                        <option value="master">최고 관리자 (Master) - 전체 접근</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-red-800 mb-1.5">구글 드라이브 문서 링크 (계약서 등)</label>
                                    <input
                                        type="url"
                                        disabled={!editMode}
                                        value={formData.contract_drive_link || ''}
                                        onChange={e => setFormData({ ...formData, contract_drive_link: e.target.value })}
                                        placeholder="https://docs.google.com/..."
                                        className="w-full bg-white border border-red-100 rounded-lg p-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-red-50/50 disabled:opacity-75 disabled:cursor-not-allowed"
                                    />
                                    {selectedEmp.contract_drive_link && !editMode && (
                                        <a href={selectedEmp.contract_drive_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-2 font-medium">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                            </svg>
                                            드라이브 열기
                                        </a>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-red-800 mb-1.5">직접 파일 첨부 (PDF, 이미지 등)</label>
                                    {editMode ? (
                                        <input
                                            type="file"
                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                            className="w-full bg-white border border-red-100 rounded-lg p-2.5 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
                                        />
                                    ) : (
                                        <div className="text-sm p-3 bg-white border border-red-100 rounded-lg text-slate-500">
                                            {selectedEmp.contract_file_url ? (
                                                <a href={selectedEmp.contract_file_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">
                                                    첨부된 파일 보기 (클릭)
                                                </a>
                                            ) : '첨부된 파일이 없습니다.'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Save Actions */}
                            {editMode && (
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData(selectedEmp);
                                            setEditMode(false);
                                            setSelectedFile(null);
                                        }}
                                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:bg-slate-400"
                                    >
                                        {isSaving ? '저장 중...' : '마스터 권한으로 저장'}
                                    </button>
                                </div>
                            )}

                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
