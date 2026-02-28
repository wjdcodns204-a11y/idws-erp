import React from 'react';
import CalendarClient from './components/CalendarClient';

export default function CalendarPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b-2 border-indigo-500 pb-2 inline-block">사내 공용 캘린더</h1>
                    <p className="text-sm text-slate-500 mt-2">직원 휴가, 업무 마감일 및 개별 구글 캘린더 일정이 통합된 공간입니다.</p>
                </div>
            </div>

            <CalendarClient />
        </div>
    );
}
