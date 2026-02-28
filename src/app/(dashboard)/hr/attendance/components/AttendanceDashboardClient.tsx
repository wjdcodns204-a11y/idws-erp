"use client";

import React, { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MobileCheckIn from './MobileCheckIn';

type AttendanceRecord = {
    id: string;
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    work_status: string;
    late_minutes: number;
    overtime_minutes: number;
    employee: {
        id: string;
        name: string;
        department: string;
    };
};

const extractLocalTime = (isoString: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const formatMinutesToTime = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return '0분';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    return `${minutes}분`;
};

export default function AttendanceDashboardClient({
    attendanceData,
    currentEmployeeId,
    isAdmin
}: {
    attendanceData: AttendanceRecord[],
    currentEmployeeId: string,
    isAdmin: boolean
}) {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [editForm, setEditForm] = useState({
        checkInTime: '',
        checkOutTime: '',
        workStatus: '',
        lateMinutes: 0,
        overtimeMinutes: 0
    });
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/hr/attendance/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();
            if (res.ok) {
                alert(`성공적으로 ${result.count}건의 근태 기록을 동기화했습니다.`);
                router.refresh();
            } else {
                alert(`업로드 실패: ${result.error}`);
            }
        } catch (error: unknown) {
            alert(`오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const openEditModal = (record: AttendanceRecord) => {
        setEditingRecord(record);
        setEditForm({
            checkInTime: extractLocalTime(record.check_in_time),
            checkOutTime: extractLocalTime(record.check_out_time),
            workStatus: record.work_status || '정상',
            lateMinutes: record.late_minutes || 0,
            overtimeMinutes: record.overtime_minutes || 0
        });
    };

    const handleSaveEdit = async () => {
        if (!editingRecord) return;

        try {
            const checkInISO = editForm.checkInTime ? `${editingRecord.date}T${editForm.checkInTime}:00+09:00` : null;
            const checkOutISO = editForm.checkOutTime ? `${editingRecord.date}T${editForm.checkOutTime}:00+09:00` : null;

            const res = await fetch('/api/hr/attendance/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingRecord.id,
                    check_in_time: checkInISO,
                    check_out_time: checkOutISO,
                    work_status: editForm.workStatus,
                    late_minutes: editForm.lateMinutes,
                    overtime_minutes: editForm.overtimeMinutes
                })
            });

            const result = await res.json();
            if (res.ok) {
                alert('기록이 성공적으로 수정되었습니다.');
                setEditingRecord(null);
                router.refresh();
            } else {
                alert(`수정 실패: ${result.error}`);
            }
        } catch (error: unknown) {
            alert(`오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    };

    // Get current month string, e.g., '2026-02'
    const [currentMonthPrefix, setCurrentMonthPrefix] = useState(new Date().toISOString().substring(0, 7));

    // Grouping and calculating stats
    const statsByEmployee = useMemo(() => {
        const stats: Record<string, {
            employee: AttendanceRecord['employee'];
            totalLate: number;
            totalOvertime: number;
            attendanceDays: number;
            records: AttendanceRecord[];
        }> = {};

        attendanceData.forEach(record => {
            // Only consider current month for stats
            if (!record.date.startsWith(currentMonthPrefix)) return;

            const empId = record.employee.id;
            if (!stats[empId]) {
                stats[empId] = {
                    employee: record.employee,
                    totalLate: 0,
                    totalOvertime: 0,
                    attendanceDays: 0,
                    records: [],
                };
            }

            stats[empId].records.push(record);
            stats[empId].totalLate += record.late_minutes || 0;
            stats[empId].totalOvertime += record.overtime_minutes || 0;
            if (record.check_in_time) {
                stats[empId].attendanceDays += 1;
            }
        });

        // Sort records by date descending inside each employee's stats
        Object.values(stats).forEach(stat => {
            stat.records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });

        return stats;
    }, [attendanceData, currentMonthPrefix]);

    // Handle Admin view vs Regular view
    const displayStats = useMemo(() => {
        if (isAdmin) {
            return Object.values(statsByEmployee);
        } else {
            // Find stats for current user
            const myStats = statsByEmployee[currentEmployeeId];
            return myStats ? [myStats] : [];
        }
    }, [isAdmin, statsByEmployee, currentEmployeeId]);


    const selectedStats = selectedEmployeeId ? statsByEmployee[selectedEmployeeId] : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        월간 근태 요약
                        <input
                            type="month"
                            title="조회 월 선택"
                            value={currentMonthPrefix}
                            onChange={(e) => setCurrentMonthPrefix(e.target.value)}
                            className="text-sm font-medium border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                        />
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {isAdmin ? '선택한 월에 출근 기록이 있는 모든 직원의 요약입니다. 카드를 클릭하면 상세 내역을 볼 수 있습니다.' : '선택한 월의 나의 근태 현황입니다. 카드를 클릭하면 상세 내역을 볼 수 있습니다.'}
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <input
                            type="file"
                            title="엑셀 업로드"
                            accept=".xls,.xlsx"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <button
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-wait text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
                        >
                            {isUploading ? '업로드 중...' : '엑셀 파일 업로드'}
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile Check-In Widget — 관리자 포함 모든 직원 표시 */}
            {currentEmployeeId && (
                <div className="mb-6">
                    <MobileCheckIn currentEmployeeId={currentEmployeeId} />
                </div>
            )}

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayStats.length > 0 ? displayStats.map(stat => (
                    <div
                        key={stat.employee.id}
                        onClick={() => setSelectedEmployeeId(stat.employee.id)}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{stat.employee.name}</h3>
                                <span className="text-xs text-slate-500">{stat.employee.department}</span>
                            </div>
                            <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-600">
                                출근 {stat.attendanceDays}일
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-100 pt-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">총 지각 (분)</span>
                                <span className={`text-xl font-bold ${stat.totalLate > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                                    {formatMinutesToTime(stat.totalLate)}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">총 연장 (분)</span>
                                <span className={`text-xl font-bold ${stat.totalOvertime > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                                    {formatMinutesToTime(stat.totalOvertime)}
                                </span>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                        데이터가 존재하지 않습니다.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedStats && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{selectedStats.employee.name} 님의 출퇴근 상세 내역</h2>
                                <p className="text-xs text-slate-500 mt-1">{currentMonthPrefix} 기준</p>
                            </div>
                            <button title="닫기" onClick={() => setSelectedEmployeeId(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">근무일</th>
                                        <th className="px-4 py-3 font-medium">출근 시간</th>
                                        <th className="px-4 py-3 font-medium">퇴근 시간</th>
                                        <th className="px-4 py-3 font-medium">지각/연장</th>
                                        <th className="px-4 py-3 font-medium">상태</th>
                                        {isAdmin && <th className="px-4 py-3 font-medium text-right">관리</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedStats.records.map(record => (
                                        <tr key={record.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-700">{record.date}</td>
                                            <td className="px-4 py-3 text-slate-600">{extractLocalTime(record.check_in_time) || '-'}</td>
                                            <td className="px-4 py-3 text-slate-600">{extractLocalTime(record.check_out_time) || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    {record.late_minutes > 0 ? <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">지각 +{formatMinutesToTime(record.late_minutes)}</span> : <span className="text-[10px] text-slate-300">-</span>}
                                                    {record.overtime_minutes > 0 ? <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">연장 +{formatMinutesToTime(record.overtime_minutes)}</span> : null}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${record.work_status === '정상' ? 'bg-emerald-100 text-emerald-700' :
                                                    record.work_status === '지각' ? 'bg-amber-100 text-amber-700' :
                                                        record.work_status === '휴가' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {record.work_status}
                                                </span>
                                            </td>
                                            {isAdmin && (
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => openEditModal(record)} title="기록 수정" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded cursor-pointer">수정</button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {selectedStats.records.length === 0 && (
                                        <tr>
                                            <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-slate-500">기록이 없습니다.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal (Admin Only) */}
            {editingRecord && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">근태 기록 수정 ({editingRecord.date})</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">상태</label>
                                <select
                                    title="근무 상태"
                                    value={editForm.workStatus}
                                    onChange={(e) => setEditForm({ ...editForm, workStatus: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="정상">정상</option>
                                    <option value="지각">지각</option>
                                    <option value="휴가">휴가</option>
                                    <option value="결근">결근</option>
                                    <option value="확인중">확인중</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">출근 시간</label>
                                    <input
                                        type="time"
                                        title="출근 시간"
                                        value={editForm.checkInTime}
                                        onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">퇴근 시간</label>
                                    <input
                                        type="time"
                                        title="퇴근 시간"
                                        value={editForm.checkOutTime}
                                        onChange={(e) => setEditForm({ ...editForm, checkOutTime: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">지각 (분)</label>
                                    <input
                                        type="number"
                                        title="지각 시간(분)"
                                        min="0"
                                        value={editForm.lateMinutes}
                                        onChange={(e) => setEditForm({ ...editForm, lateMinutes: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">연장 (분)</label>
                                    <input
                                        type="number"
                                        title="연장 시간(분)"
                                        min="0"
                                        value={editForm.overtimeMinutes}
                                        onChange={(e) => setEditForm({ ...editForm, overtimeMinutes: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-6">
                            <button onClick={() => setEditingRecord(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">취소</button>
                            <button onClick={handleSaveEdit} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer">저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
