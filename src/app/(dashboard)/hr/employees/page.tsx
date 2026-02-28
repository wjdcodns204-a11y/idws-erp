import React from 'react';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
    const supabaseAdmin = createSupabaseAdmin();
    const { data: employees, error } = await supabaseAdmin
        .from('employees')
        .select('*')
        .order('role', { ascending: true }) // 관리자가 위로 오도록 임시 정렬
        .order('name');

    if (error) {
        return <div className="p-4 text-red-500">데이터를 불러오는 중 오류가 발생했습니다: {error.message}</div>;
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-800">역할 및 직원 명부 ({employees?.length || 0}명)</h2>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                    + 새 직원 등록
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-medium">이름</th>
                            <th className="px-4 py-3 font-medium">메일주소 (ID)</th>
                            <th className="px-4 py-3 font-medium">소속 부서</th>
                            <th className="px-4 py-3 font-medium">직급</th>
                            <th className="px-4 py-3 font-medium">권한 레벨</th>
                            <th className="px-4 py-3 font-medium">상태</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employees?.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-900 border-l-2 border-transparent hover:border-indigo-500">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold uppercase">
                                            {emp.name?.charAt(0) || "-"}
                                        </div>
                                        {emp.name}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500">{emp.email}</td>
                                <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-semibold">{emp.position}</span>
                                </td>
                                <td className="px-4 py-3">
                                    {emp.role === 'admin' ? (
                                        <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded">Admin</span>
                                    ) : emp.role === 'leader' ? (
                                        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Leader</span>
                                    ) : (
                                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Staff</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {emp.status === 'active' ? (
                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 재직중
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> 비활성
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {(!employees || employees.length === 0) && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                    데이터가 존재하지 않습니다. setup-hr-db.sql 을 실행해주세요.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
