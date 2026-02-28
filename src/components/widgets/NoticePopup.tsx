"use client";

import React, { useMemo, useState } from 'react';

type Notice = { id: string; title: string; content: string; importance: string; author_name: string; created_at: string; };

// 공지사항 팝업: 이미 닫은 공지는 localStorage에 기록
export default function NoticePopup({ notices }: { notices: Notice[] }) {
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        return JSON.parse(localStorage.getItem('dismissed_notices') || '[]') as string[];
    });

    const visible = useMemo(
        () => notices.filter(n => !dismissedIds.includes(n.id)),
        [notices, dismissedIds]
    );

    const dismiss = (id: string) => {
        const updated = [...dismissedIds, id];
        setDismissedIds(updated);
        localStorage.setItem('dismissed_notices', JSON.stringify(updated));
    };

    if (visible.length === 0) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 space-y-2 pointer-events-none">
            {visible.map(notice => (
                <div key={notice.id}
                    className={`bg-white rounded-2xl shadow-2xl pointer-events-auto border-2 ${notice.importance === '긴급' ? 'border-red-400' : 'border-indigo-200'}`}>
                    <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{notice.importance === '긴급' ? '🚨' : '📢'}</span>
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wide ${notice.importance === '긴급' ? 'text-red-500' : 'text-indigo-500'}`}>
                                        {notice.importance === '긴급' ? '긴급 공지' : '사내 공지'}
                                    </p>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{notice.title}</p>
                                </div>
                            </div>
                            <button onClick={() => dismiss(notice.id)}
                                title="공지 닫기"
                                className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {notice.content && (
                            <p className="text-xs text-slate-500 mt-2 pl-8">{notice.content}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2 pl-8">
                            {notice.author_name} · {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
