"use client";

import React, { useState } from 'react';

type CalendarEvent = { id: string; title: string; event_date: string; platform: string; color: string; memo?: string; is_auto: boolean; };
type PlmCard = { id: string; title: string; target_date: string; stage: string; };
type PlatformFee = { platform_name: string; color: string; };

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
    return new Date(year, month - 1, 1).getDay(); // 0=일요일
}

export default function CalendarClient({
    initialEvents, plmCards, platformFees, initialYear, initialMonth
}: {
    initialEvents: CalendarEvent[];
    plmCards: PlmCard[];
    platformFees: PlatformFee[];
    initialYear: number;
    initialMonth: number;
}) {
    const [year, setYear] = useState(initialYear);
    const [month, setMonth] = useState(initialMonth);
    const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
    const [showForm, setShowForm] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [newEvent, setNewEvent] = useState({ title: '', platform: '무신사', memo: '' });
    const [isSaving, setIsSaving] = useState(false);

    const platformColorMap = Object.fromEntries(platformFees.map(p => [p.platform_name, p.color]));
    platformColorMap['PLM'] = '#f59e0b'; // PLM 자동 이벤트 색상

    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    };

    const daysInMonth = getDaysInMonth(year, month);
    const firstDow = getFirstDayOfWeek(year, month);

    const getDateStr = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const getEventsForDay = (d: number) => {
        const dateStr = getDateStr(d);
        const manualEvents = events.filter(e => e.event_date === dateStr);
        const plmDots = plmCards.filter(c => c.target_date === dateStr);
        return { manualEvents, plmDots };
    };

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEvent.title.trim() || !selectedDate) return alert('제목과 날짜를 확인해주세요.');
        setIsSaving(true);
        try {
            const color = platformColorMap[newEvent.platform] || '#6366f1';
            const res = await fetch('/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newEvent, event_date: selectedDate, color }),
            });
            if (res.ok) {
                const data = await res.json();
                setEvents(prev => [...prev, data.event]);
                setShowForm(false);
                setNewEvent({ title: '', platform: '무신사', memo: '' });
            }
        } catch { alert('오류 발생'); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">{year}년 {month}월</h2>
                    <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    {/* 범례 */}
                    <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                        {platformFees.slice(0, 4).map(p => (
                            <div key={p.platform_name} className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></div>
                                <span>{p.platform_name}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                            <span>PLM</span>
                        </div>
                    </div>
                    <button onClick={() => { setSelectedDate(getDateStr(new Date().getDate())); setShowForm(true); }}
                        className="flex items-center gap-1.5 bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md hover:bg-slate-900 transition-all active:scale-95">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        이벤트 추가
                    </button>
                </div>
            </div>

            {/* 이벤트 추가 폼 */}
            {showForm && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">📅 새 런칭 이벤트 추가</h3>
                    <form onSubmit={handleAddEvent} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1">이벤트 제목</label>
                            <input type="text" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                placeholder="예: 26SS 런칭 시즌 오픈"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">날짜</label>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">플랫폼</label>
                            <select value={newEvent.platform} onChange={e => setNewEvent({ ...newEvent, platform: e.target.value })}
                                title="플랫폼 선택"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                {platformFees.map(p => <option key={p.platform_name} value={p.platform_name}>{p.platform_name}</option>)}
                                <option value="기타">기타</option>
                            </select>
                        </div>
                        <div className="col-span-2 md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">메모 (선택)</label>
                            <input type="text" value={newEvent.memo} onChange={e => setNewEvent({ ...newEvent, memo: e.target.value })}
                                placeholder="특이사항"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="flex items-end gap-2">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">취소</button>
                            <button type="submit" disabled={isSaving}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:bg-slate-400">
                                {isSaving ? '...' : '추가'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 캘린더 그리드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                    {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                        <div key={d} className={`py-3 text-center text-xs font-bold ${d === '일' ? 'text-red-500' : d === '토' ? 'text-blue-500' : 'text-slate-500'}`}>{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {Array.from({ length: firstDow }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-slate-50"></div>
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const { manualEvents, plmDots } = getEventsForDay(day);
                        const isToday = getDateStr(day) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                        const dayOfWeek = (firstDow + day - 1) % 7;
                        return (
                            <div key={day} className="min-h-[100px] border-b border-r border-slate-50 p-2 flex flex-col gap-1">
                                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold self-start transition-colors
                                    ${isToday ? 'bg-indigo-600 text-white shadow-md' : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                                    {day}
                                </div>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                    {manualEvents.map(event => (
                                        <div key={event.id}
                                            style={{ backgroundColor: event.color + '20', borderLeftColor: event.color, color: event.color }}
                                            className="text-[10px] px-1.5 py-0.5 rounded border-l-2 font-semibold truncate">
                                            {event.title}
                                        </div>
                                    ))}
                                    {plmDots.map(card => (
                                        <div key={card.id}
                                            className="text-[10px] px-1.5 py-0.5 rounded border-l-2 border-amber-400 bg-amber-50 text-amber-700 font-semibold truncate flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                                            {card.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
