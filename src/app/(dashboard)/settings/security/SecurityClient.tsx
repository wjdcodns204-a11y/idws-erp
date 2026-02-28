'use client';

import { useState } from 'react';

type RolePermission = {
    id: string; role: string; menu_key: string;
    can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean;
};

type ActivityLog = {
    id: string; user_email: string; user_name: string;
    action: string; resource: string; description: string;
    created_at: string; ip_address: string;
};

type Employee = { name: string; email: string; role: string; department: string };

type Tab = 'permissions' | 'logs' | 'users';

const MENUS = [
    { key: 'dashboard', label: '📊 대시보드' },
    { key: 'inventory', label: '📦 재고 관리' },
    { key: 'purchase_orders', label: '🛒 발주 관리' },
    { key: 'orders', label: '📋 주문/CS' },
    { key: 'finance', label: '💰 재무 관리' },
    { key: 'hr', label: '👥 인사 관리' },
    { key: 'hr_payroll', label: '💸 급여 관리' },
    { key: 'plm', label: '🧵 PLM 보드' },
    { key: 'analytics', label: '📈 분석 리포팅' },
    { key: 'settings', label: '⚙️ 설정' },
];

const ROLES = [
    { key: 'admin', label: '👑 대표 (Admin)', color: 'text-red-600' },
    { key: 'leader', label: '⭐ 팀장 (Leader)', color: 'text-amber-600' },
    { key: 'staff', label: '👤 사원 (Staff)', color: 'text-slate-600' },
];

const ACTION_BADGES: Record<string, string> = {
    create: 'bg-emerald-50 text-emerald-700',
    update: 'bg-amber-50 text-amber-700',
    delete: 'bg-red-50 text-red-600',
    view: 'bg-slate-50 text-slate-500',
    login: 'bg-blue-50 text-blue-700',
    logout: 'bg-slate-50 text-slate-500',
};

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    leader: 'bg-amber-100 text-amber-700',
    staff: 'bg-slate-100 text-slate-600',
};

export default function SecurityClient({
    initialPermissions, initialLogs, employees,
}: {
    currentUserRole: string;
    initialPermissions: RolePermission[];
    initialLogs: ActivityLog[];
    employees: Employee[];
}) {
    const [tab, setTab] = useState<Tab>('permissions');
    const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions);
    const [logs] = useState<ActivityLog[]>(initialLogs);
    const [saving, setSaving] = useState(false);
    const [logFilter, setLogFilter] = useState('');

    // 권한 조회 헬퍼
    const getPerm = (role: string, menuKey: string) =>
        permissions.find(p => p.role === role && p.menu_key === menuKey) || {
            id: '', role, menu_key: menuKey,
            can_view: false, can_create: false, can_edit: false, can_delete: false,
        };

    // 권한 토글
    const handlePermToggle = async (role: string, menuKey: string, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
        if (role === 'admin') return; // admin 권한은 변경 불가
        const current = getPerm(role, menuKey);
        const updated = { ...current, [field]: !current[field as keyof typeof current] };

        setSaving(true);
        const res = await fetch('/api/security/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, menu_key: menuKey, ...updated }),
        });
        if (res.ok) {
            setPermissions(prev => {
                const idx = prev.findIndex(p => p.role === role && p.menu_key === menuKey);
                if (idx >= 0) return prev.map((p, i) => i === idx ? { ...p, [field]: !p[field as keyof typeof p] } : p);
                return [...prev, updated as RolePermission];
            });
        }
        setSaving(false);
    };

    const filteredLogs = logFilter
        ? logs.filter(l => l.user_email.includes(logFilter) || l.description?.includes(logFilter) || l.resource.includes(logFilter))
        : logs;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">보안·권한 관리</h1>
                    <p className="text-sm text-slate-500 mt-1">역할별 메뉴 접근 권한을 설정하고 시스템 활동 로그를 확인합니다.</p>
                </div>
                {saving && <span className="text-xs text-amber-600 font-semibold animate-pulse">저장 중...</span>}
            </div>

            {/* 탭 */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {([['permissions', '🔐 권한 설정'], ['logs', '📋 활동 로그'], ['users', '👥 직원 목록']] as [Tab, string][]).map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── 권한 설정 탭 ── */}
            {tab === 'permissions' && (
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                        ⚠️ <strong>관리자(Admin)</strong> 역할은 항상 모든 권한을 가집니다. 팀장과 사원 권한만 조정 가능합니다.
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-sm min-w-[700px]">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">메뉴</th>
                                    {ROLES.map(r => (
                                        <th key={r.key} className={`px-3 py-3 text-center ${r.color}`} colSpan={4}>{r.label}</th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50 border-t border-slate-100">
                                    <th className="px-4 py-2" />
                                    {ROLES.flatMap(() => [
                                        <th key="v" className="px-2 py-2 text-center text-slate-400 font-normal">조회</th>,
                                        <th key="c" className="px-2 py-2 text-center text-slate-400 font-normal">생성</th>,
                                        <th key="e" className="px-2 py-2 text-center text-slate-400 font-normal">수정</th>,
                                        <th key="d" className="px-2 py-2 text-center text-slate-400 font-normal">삭제</th>,
                                    ])}
                                </tr>
                            </thead>
                            <tbody>
                                {MENUS.map(menu => (
                                    <tr key={menu.key} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-700 text-sm">{menu.label}</td>
                                        {ROLES.flatMap(role => {
                                            const perm = getPerm(role.key, menu.key);
                                            const isAdmin = role.key === 'admin';
                                            return (
                                                ['can_view', 'can_create', 'can_edit', 'can_delete'].map(field => (
                                                    <td key={`${role.key}-${field}`} className="px-2 py-3 text-center">
                                                        <button
                                                            onClick={() => handlePermToggle(role.key, menu.key, field as 'can_view' | 'can_create' | 'can_edit' | 'can_delete')}
                                                            disabled={isAdmin || saving}
                                                            className={`w-6 h-6 rounded transition-all ${isAdmin || (perm[field as keyof typeof perm] as boolean)
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-slate-200 text-slate-400'
                                                                } ${isAdmin ? 'cursor-not-allowed opacity-60' : 'hover:scale-110 cursor-pointer'} text-xs font-bold`}>
                                                            {(isAdmin || (perm[field as keyof typeof perm] as boolean)) ? '✓' : '✗'}
                                                        </button>
                                                    </td>
                                                ))
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── 활동 로그 탭 ── */}
            {tab === 'logs' && (
                <div className="space-y-4">
                    <input type="text" value={logFilter} onChange={e => setLogFilter(e.target.value)}
                        placeholder="이메일, 리소스, 내용으로 검색..."
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th className="px-4 py-3 text-left">시간</th>
                                        <th className="px-4 py-3 text-left">사용자</th>
                                        <th className="px-4 py-3 text-center">액션</th>
                                        <th className="px-4 py-3 text-left">내용</th>
                                        <th className="px-4 py-3 text-left hidden lg:table-cell">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-slate-400">활동 로그가 없습니다</td></tr>
                                    ) : filteredLogs.slice(0, 100).map(log => (
                                        <tr key={log.id} className="border-b border-slate-50">
                                            <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <p className="font-medium text-slate-700 text-xs">{log.user_name || log.user_email.split('@')[0]}</p>
                                                <p className="text-slate-400 text-xs">{log.user_email}</p>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_BADGES[log.action] || 'bg-slate-50 text-slate-600'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-slate-600 max-w-xs truncate">{log.description}</td>
                                            <td className="px-4 py-2.5 text-xs text-slate-400 hidden lg:table-cell">{log.ip_address || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filteredLogs.length > 100 && (
                            <p className="text-center text-xs text-slate-400 py-2">최근 100건만 표시 중 (전체 {filteredLogs.length}건)</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── 직원별 역할 탭 ── */}
            {tab === 'users' && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                            <tr>
                                <th className="px-5 py-3 text-left">이름</th>
                                <th className="px-5 py-3 text-left">부서</th>
                                <th className="px-5 py-3 text-center">역할</th>
                                <th className="px-5 py-3 text-left">이메일</th>
                                <th className="px-5 py-3 text-center">역할 변경</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.email} className="border-b border-slate-50">
                                    <td className="px-5 py-3 font-semibold text-slate-800">{emp.name}</td>
                                    <td className="px-5 py-3 text-slate-500 text-xs">{emp.department}</td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[emp.role] || 'bg-slate-100'}`}>
                                            {emp.role === 'admin' ? '👑 대표' : emp.role === 'leader' ? '⭐ 팀장' : '👤 사원'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-slate-400">{emp.email}</td>
                                    <td className="px-5 py-3 text-center">
                                        <select
                                            defaultValue={emp.role}
                                            onChange={async (e) => {
                                                await fetch('/api/hr/employees', {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email: emp.email, role: e.target.value }),
                                                });
                                            }}
                                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
                                            <option value="staff">사원</option>
                                            <option value="leader">팀장</option>
                                            <option value="admin">대표</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
