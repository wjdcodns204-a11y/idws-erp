"use client";

import React, { useState } from 'react';

type JobData = {
    last_success: string | null;
    last_failure: string | null;
    last_error: string | null;
};

const JOB_ICONS: Record<string, string> = {
    '이지어드민 재고': '📦',
    '이지어드민 주문': '🛒',
    '카페24': '🏪',
};

const JOB_DESCRIPTIONS: Record<string, string> = {
    '이지어드민 재고': '매일 오전 9:30 이지어드민에서 재고 데이터를 자동 수집합니다.',
    '이지어드민 주문': '이지어드민 주문 내역을 자동으로 수집합니다.',
    '카페24': '카페24 스토어의 데이터를 자동으로 동기화합니다.',
};

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return '기록 없음';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (mins > 0) return `${mins}분 전`;
    return '방금 전';
}

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

export default function AutomationDashboardClient({
    jobDataMap, jobNames
}: { jobDataMap: Record<string, JobData>; jobNames: string[] }) {
    const [testingJob, setTestingJob] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, string>>({});

    const handleManualRun = async (jobName: string) => {
        setTestingJob(jobName);
        try {
            const endpointMap: Record<string, string> = {
                '이지어드민 재고': '/api/ezadmin/scrape',
                '이지어드민 주문': '/api/ezadmin/orders',
                '카페24': '/api/cafe24/sync',
            };
            const endpoint = endpointMap[jobName];
            if (!endpoint) return;

            const res = await fetch(endpoint, { method: 'POST' });
            const data = await res.json();
            setTestResult(prev => ({
                ...prev,
                [jobName]: data.success ? '✅ 수동 실행 성공!' : `❌ 실패: ${data.error || '오류 발생'}`
            }));
        } catch (e) {
            setTestResult(prev => ({ ...prev, [jobName]: '❌ 연결 실패' }));
        } finally {
            setTestingJob(null);
        }
    };

    return (
        <div className="space-y-4">
            {jobNames.map(job => {
                const data = jobDataMap[job] || { last_success: null, last_failure: null, last_error: null };
                const isHealthy = data.last_success && (!data.last_failure
                    || new Date(data.last_success) > new Date(data.last_failure));
                const hasFailed = data.last_failure && (!data.last_success
                    || new Date(data.last_failure) > new Date(data.last_success));

                return (
                    <div key={job}
                        className={`bg-white rounded-2xl border-2 shadow-sm p-6 transition-all ${hasFailed ? 'border-red-200' : isHealthy ? 'border-emerald-200' : 'border-slate-100'}`}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${hasFailed ? 'bg-red-50' : isHealthy ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                    {JOB_ICONS[job] || '⚙️'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-800">{job}</h3>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hasFailed ? 'bg-red-100 text-red-600' : isHealthy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {hasFailed ? '❌ 마지막 실행 실패' : isHealthy ? '✅ 정상' : '⏳ 기록 없음'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{JOB_DESCRIPTIONS[job]}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleManualRun(job)}
                                disabled={testingJob === job}
                                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-3 py-2 rounded-xl transition-all disabled:opacity-40">
                                {testingJob === job ? (
                                    <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                                    </svg>
                                )}
                                수동 실행
                            </button>
                        </div>

                        {/* 타임라인 */}
                        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-50">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-emerald-600">마지막 성공</p>
                                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{formatDateTime(data.last_success)}</p>
                                    <p className="text-xs text-slate-400">{timeAgo(data.last_success)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${data.last_failure ? 'bg-red-50' : 'bg-slate-50'}`}>
                                    <svg className={`w-4 h-4 ${data.last_failure ? 'text-red-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className={`text-xs font-bold ${data.last_failure ? 'text-red-500' : 'text-slate-400'}`}>마지막 실패</p>
                                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{formatDateTime(data.last_failure)}</p>
                                    {data.last_error && (
                                        <p className="text-xs text-red-400 mt-0.5 line-clamp-2">{data.last_error}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 수동 실행 결과 */}
                        {testResult[job] && (
                            <div className={`mt-3 text-xs font-bold px-3 py-2 rounded-lg ${testResult[job].startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {testResult[job]}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
