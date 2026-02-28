"use client";

import React, { useState } from 'react';

type Employee = { id: string; name: string; department: string; role: string; };

type WorkLog = {
    id: string;
    log_date: string;
    content: string; // JSON string for { today: string, tomorrow: string }
    created_at: string;
    employee: Employee;
};

export default function WorkLogBoard({
    currentUser,
    recentLogs,
    hasDraftedToday,
    todayLogData
}: {
    currentUser: Employee,
    recentLogs: WorkLog[],
    hasDraftedToday: boolean,
    todayLogData?: WorkLog
}) {
    // If already drafted today, we can populate initial state from what was saved
    const savedContent = todayLogData?.content ? JSON.parse(todayLogData.content) : { today: '', tomorrow: '' };

    const [todayTask, setTodayTask] = useState(savedContent.today || '');
    const [tomorrowTask, setTomorrowTask] = useState(savedContent.tomorrow || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!todayTask.trim() || !tomorrowTask.trim()) {
            return alert('오늘 한 일과 내일 할 일을 모두 간략히 적어주세요!');
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/hr/worklogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: currentUser.id,
                    todayTask,
                    tomorrowTask
                })
            });

            if (res.ok) {
                alert('업무 일지가 저장되었습니다. 수고하셨습니다!');
                window.location.reload();
            } else {
                const data = await res.json();
                alert(`저장 실패: ${data.error}`);
            }
        } catch (error: any) {
            alert(`오류 발생: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderLogFeed = (log: WorkLog) => {
        let parsed;
        try { parsed = JSON.parse(log.content); } catch { parsed = { today: log.content, tomorrow: '' }; }

        return (
            <div key={log.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col space-y-3">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                            {log.employee.name.charAt(0)}
                        </div>
                        <div>
                            <span className="font-bold text-sm text-slate-800 block">{log.employee.name}</span>
                            <span className="text-xs text-slate-500">{log.employee.department}</span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-400">
                        {log.log_date} {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 오늘 한 일
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{parsed.today}</p>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span> 내일 할 일
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{parsed.tomorrow}</p>
                    </div>
                </div>
            </div>
        );
    };

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const todayFeed = recentLogs.filter(l => l.log_date === todayStr);
    const yesterdayFeed = recentLogs.filter(l => l.log_date !== todayStr);

    return (
        <div className="space-y-8 pb-10">
            {/* Input Box */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h2 className="text-lg font-bold text-slate-800 mb-4">{hasDraftedToday ? '오늘 일지 수정하기' : '오늘의 업무 일지 작성'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 block"></span> 1. 오늘 한 일
                            </label>
                            <textarea
                                value={todayTask}
                                onChange={e => setTodayTask(e.target.value)}
                                rows={4}
                                placeholder="- 신제품 상세페이지 기획\n- 1차 메인 배너 디자인"
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 block"></span> 2. 내일 할 일
                            </label>
                            <textarea
                                value={tomorrowTask}
                                onChange={e => setTomorrowTask(e.target.value)}
                                rows={4}
                                placeholder="- 디자인 시안 대표님 컨펌 요청\n- 무신사 프로모션 기획안 작성"
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-slate-300"
                        >
                            {isSubmitting ? '저장 중...' : (hasDraftedToday ? '일지 수정하기' : '기록하고 퇴근하기')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Feed List */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">오늘 (<span className="text-indigo-500">{todayFeed.length}</span>)</h3>
                    {todayFeed.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-sm text-slate-400">아직 오늘 업무 일지를 작성한 직원이 없습니다.</div>
                    ) : (
                        <div className="space-y-4">
                            {todayFeed.map(renderLogFeed)}
                        </div>
                    )}
                </div>

                {yesterdayFeed.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 mb-3 px-1 uppercase tracking-wider">어제 (<span className="text-slate-500">{yesterdayFeed.length}</span>)</h3>
                        <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                            {yesterdayFeed.map(renderLogFeed)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
