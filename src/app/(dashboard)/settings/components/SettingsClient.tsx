"use client";

import React, { useState } from 'react';

type PlatformFee = { id: string; platform_name: string; fee_pct: number; color: string; };
type SystemSetting = { key: string; value: string; description: string; };

export default function SettingsClient({
    platformFees,
    systemSettings,
    isMaster,
    initialKpi,
}: {
    platformFees: PlatformFee[];
    systemSettings: SystemSetting[];
    isMaster: boolean;
    initialKpi?: { monthly_goal: number; low_stock_threshold: number };
}) {
    const [fees, setFees] = useState<PlatformFee[]>(platformFees);
    const [settings, setSettings] = useState<SystemSetting[]>(systemSettings);
    const [isSaving, setIsSaving] = useState(false);
    const [newPlatform, setNewPlatform] = useState({ platform_name: '', fee_pct: 0, color: '#6366f1' });

    // KPI 설정 상태
    const [monthlyGoal, setMonthlyGoal] = useState(initialKpi?.monthly_goal || 210000000);
    const [lowStockThreshold, setLowStockThreshold] = useState(initialKpi?.low_stock_threshold || 20);
    const [kpiSaving, setKpiSaving] = useState(false);
    const [kpiSaved, setKpiSaved] = useState(false);

    const handleSaveKpi = async () => {
        setKpiSaving(true);
        try {
            const res = await fetch('/api/dashboard/kpi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthly_goal: monthlyGoal, low_stock_threshold: lowStockThreshold }),
            });
            if (res.ok) { setKpiSaved(true); setTimeout(() => setKpiSaved(false), 3000); }
            else alert('저장 실패. 다시 시도해주세요.');
        } catch { alert('오류 발생'); }
        finally { setKpiSaving(false); }
    };

    const handleFeeChange = (id: string, field: keyof PlatformFee, value: string | number) => {
        setFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const handleSettingChange = (key: string, value: string) => {
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    };

    const handleSaveFees = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings/platform-fees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fees }),
            });
            if (res.ok) alert('수수료 설정이 저장되었습니다!');
            else alert('저장 실패. 다시 시도해주세요.');
        } catch { alert('오류 발생'); }
        finally { setIsSaving(false); }
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            if (res.ok) alert('API 설정이 저장되었습니다!');
            else alert('저장 실패.');
        } catch { alert('오류 발생'); }
        finally { setIsSaving(false); }
    };

    const handleAddPlatform = async () => {
        if (!newPlatform.platform_name.trim()) return alert('플랫폼 이름을 입력해주세요.');
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings/platform-fees/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPlatform),
            });
            if (res.ok) {
                const data = await res.json();
                setFees(prev => [...prev, data.fee]);
                setNewPlatform({ platform_name: '', fee_pct: 0, color: '#6366f1' });
                alert(`${newPlatform.platform_name} 플랫폼이 추가되었습니다!`);
            }
        } catch { alert('오류 발생'); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-8">
            {/* ─── KPI 목표 설정 섹션 ─── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">🎯 대시보드 KPI 목표</h2>
                        <p className="text-sm text-slate-500 mt-0.5">메인 대시보드에 표시될 목표와 경고 기준을 설정합니다.</p>
                    </div>
                    <button onClick={handleSaveKpi} disabled={kpiSaving}
                        className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-all active:scale-95 disabled:bg-slate-300 ${kpiSaved ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {kpiSaving ? '저장 중...' : kpiSaved ? '✓ 저장됨' : 'KPI 저장'}
                    </button>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">월 매출 목표 (원)</label>
                        <input type="number" value={monthlyGoal} onChange={e => setMonthlyGoal(Number(e.target.value))}
                            placeholder="210000000" step={1000000}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                        <p className="text-xs text-slate-400 mt-1">현재: {(monthlyGoal / 100000000).toFixed(1)}억원</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">재고 부족 기준 수량 (개)</label>
                        <input type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(Number(e.target.value))}
                            placeholder="20" min={1}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                        <p className="text-xs text-slate-400 mt-1">이 수량 이하 상품을 대시보드에서 경고 표시</p>
                    </div>
                </div>
            </div>

            {/* 플랫폼 수수료 섹션 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">플랫폼별 판매 수수료율</h2>
                        <p className="text-sm text-slate-500 mt-0.5">마진율 계산 시 자동으로 적용됩니다.</p>
                    </div>
                    <button onClick={handleSaveFees} disabled={isSaving}
                        className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all active:scale-95 disabled:bg-slate-300">
                        {isSaving ? '저장 중...' : '수수료 저장'}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase tracking-wide">
                            <tr>
                                <th className="px-6 py-3 text-left">플랫폼</th>
                                <th className="px-6 py-3 text-center">캘린더 색상</th>
                                <th className="px-6 py-3 text-right">수수료율 (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fees.map(fee => (
                                <tr key={fee.id} className="border-b border-slate-50">
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fee.color }}></div>
                                            <span className="font-semibold text-slate-700">{fee.platform_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5 text-center">
                                        <input type="color" value={fee.color}
                                            onChange={e => handleFeeChange(fee.id, 'color', e.target.value)}
                                            className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200" />
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                        <input type="number" value={fee.fee_pct}
                                            onChange={e => handleFeeChange(fee.id, 'fee_pct', Number(e.target.value))}
                                            min={0} max={100} step={0.1}
                                            className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
                                        <span className="ml-1 text-slate-500">%</span>
                                    </td>
                                </tr>
                            ))}
                            {/* 새 플랫폼 추가 행 */}
                            <tr className="bg-slate-50/50">
                                <td className="px-6 py-3.5">
                                    <input type="text" value={newPlatform.platform_name}
                                        onChange={e => setNewPlatform({ ...newPlatform, platform_name: e.target.value })}
                                        placeholder="새 플랫폼명 입력"
                                        className="border border-dashed border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                    <input type="color" value={newPlatform.color}
                                        onChange={e => setNewPlatform({ ...newPlatform, color: e.target.value })}
                                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200" />
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <input type="number" value={newPlatform.fee_pct}
                                            onChange={e => setNewPlatform({ ...newPlatform, fee_pct: Number(e.target.value) })}
                                            min={0} max={100} step={0.1}
                                            className="w-20 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-500" />
                                        <span className="text-slate-500 text-sm">%</span>
                                        <button onClick={handleAddPlatform} disabled={isSaving}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg">
                                            + 추가
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* API 키 설정 섹션 (Master 전용) */}
            {isMaster && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">외부 API 연동 설정</h2>
                            <p className="text-sm text-slate-500 mt-0.5">이지어드민 API 키 설정 (대표님만 수정 가능)</p>
                        </div>
                        <button onClick={handleSaveSettings} disabled={isSaving}
                            className="px-5 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-all active:scale-95 disabled:bg-slate-300">
                            {isSaving ? '저장 중...' : 'API 설정 저장'}
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {settings.map(setting => (
                            <div key={setting.key}>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                                    {setting.description}
                                </label>
                                <input
                                    type={setting.key.includes('key') ? 'password' : 'text'}
                                    value={setting.value}
                                    onChange={e => handleSettingChange(setting.key, e.target.value)}
                                    placeholder={setting.key.includes('key') ? '••••••••••••••••••••' : setting.key}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
