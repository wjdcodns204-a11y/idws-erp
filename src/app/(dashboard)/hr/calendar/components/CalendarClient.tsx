"use client";

import React, { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-client';

type CalendarEvent = {
    id: string;
    title: string;
    date: string;
    endDate?: string;
    type: 'leave' | 'task' | 'google';
    colorClass: string;
    assignee?: string;
};

export default function CalendarClient() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const supabase = createSupabaseBrowser();

            // 1. Fetch Leaves
            const { data: leaves } = await supabase
                .from('leaves')
                .select('id, type, start_date, end_date, status, employee:employees!leaves_employee_id_fkey(name)')
                .eq('status', '승인됨'); // Only approved leaves, or all? Let's show all for now, maybe distinguish by color

            // 2. Fetch Tasks with Due Dates
            const { data: tasks } = await supabase
                .from('tasks')
                .select('id, title, due_date, type, status, assignee:employees!tasks_assignee_id_fkey(name)')
                .not('due_date', 'is', null);

            type LeaveData = { id: string; type: string; start_date: string; end_date: string; status: string; employee: { name: string } | null };
            type TaskData = { id: string; title: string; due_date: string; type: string; status: string; assignee: { name: string } | null };
            const allEvents: CalendarEvent[] = [];

            if (leaves) {
                const typedLeaves = leaves as unknown as LeaveData[];
                typedLeaves.forEach((l) => {
                    const start = new Date(l.start_date);
                    const end = new Date(l.end_date);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        allEvents.push({
                            id: `leave_${l.id}_${d.getTime()}`,
                            title: `[휴가] ${l.employee?.name || '알 수 없음'} (${l.type})`,
                            date: d.toISOString().split('T')[0],
                            type: 'leave',
                            colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        });
                    }
                });
            }

            if (tasks) {
                const typedTasks = tasks as unknown as TaskData[];
                typedTasks.forEach((t) => {
                    allEvents.push({
                        id: `task_${t.id}`,
                        title: `[${t.type}] ${t.title}`,
                        date: t.due_date.substring(0, 10),
                        type: 'task',
                        assignee: t.assignee?.name,
                        colorClass: t.status === '완료' ? 'bg-slate-100 text-slate-500 border-slate-200 line-through' : 'bg-rose-100 text-rose-700 border-rose-200'
                    });
                });
            }

            // 3. Fetch Google Calendar Events (To be implemented via API)
            try {
                const res = await fetch('/api/hr/calendar/events');
                if (res.ok) {
                    const googleEvents = await res.json();
                    if (googleEvents && Array.isArray(googleEvents.events)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        googleEvents.events.forEach((ge: any) => {
                            if (ge.start && (ge.start.date || ge.start.dateTime)) {
                                const d = ge.start.date || ge.start.dateTime.substring(0, 10);
                                allEvents.push({
                                    id: `gcal_${ge.id}`,
                                    title: `[G] ${ge.summary}`,
                                    date: d,
                                    type: 'google',
                                    colorClass: 'bg-blue-100 text-blue-700 border-blue-200'
                                });
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('Google Calendar fetch failed', e);
            }

            setEvents(allEvents);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [currentDate]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const today = () => setCurrentDate(new Date());

    // Calendar Grid Logic
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0: Sun, 1: Mon...

    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const isToday = (d: number) => {
        const t = new Date();
        return t.getDate() === d && t.getMonth() === month && t.getFullYear() === year;
    };

    const getEventsForDay = (d: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return events.filter(e => e.date === dateStr);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {year}년 {month + 1}월
                    </h2>
                    {isLoading && <span className="text-xs text-indigo-500 font-medium px-2 py-1 bg-indigo-50 rounded-full animate-pulse">동기화 중...</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={today} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors">오늘</button>
                    <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
                        <button onClick={prevMonth} title="이전 달" className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="w-px bg-slate-200"></div>
                        <button onClick={nextMonth} title="다음 달" className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid Header (Days of week) */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                    <div key={day} className={`py-3 text-center text-xs font-bold uppercase tracking-widest ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
                {blanks.map(b => (
                    <div key={`blank-${b}`} className="min-h-[120px] p-2 border-b border-r border-slate-100 bg-slate-50/50"></div>
                ))}
                {days.map(d => {
                    const dayEvents = getEventsForDay(d);
                    const dayOfWeek = new Date(year, month, d).getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    return (
                        <div key={d} className={`min-h-[120px] p-2 border-b border-r border-slate-100 transition-colors hover:bg-slate-50 ${isWeekend ? 'bg-slate-50/30' : 'bg-white'}`}>
                            <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday(d) ? 'bg-indigo-600 text-white shadow-sm' : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                                {d}
                            </div>
                            <div className="space-y-1.5 mt-2">
                                {dayEvents.map(evt => (
                                    <div key={evt.id} className={`text-[10px] leading-tight px-1.5 py-1 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity ${evt.colorClass}`} title={`${evt.title}${evt.assignee ? ` (${evt.assignee})` : ''}`}>
                                        <span className="font-semibold">{evt.title}</span>
                                        {evt.assignee && <span className="opacity-80 ml-1">[{evt.assignee}]</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
