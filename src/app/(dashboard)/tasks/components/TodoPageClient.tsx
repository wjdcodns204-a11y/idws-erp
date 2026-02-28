"use client";

import React, { useState } from 'react';

const PRIORITY_CONFIG = {
    '긴급': { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', icon: '🔴' },
    '일반': { color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', icon: '🟡' },
    '낮음': { color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', icon: '🟢' },
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const REPEAT_LABELS: Record<string, string> = { daily: '매일', weekly: '매주', monthly: '매월' };

type Todo = {
    id: string; employee_email: string; title: string;
    priority: '긴급' | '일반' | '낮음'; due_date: string | null;
    is_done: boolean; repeat_type: string | null; repeat_day: number | null;
};

type NewForm = {
    title: string; priority: '긴급' | '일반' | '낮음'; due_date: string;
    repeat_type: string; repeat_day: number;
};

export default function TodoPageClient({ initialTodos, userEmail }: { initialTodos: Todo[]; userEmail: string; }) {
    const [todos, setTodos] = useState<Todo[]>(initialTodos);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<'all' | '긴급' | '일반' | '낮음' | 'done'>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<NewForm>({ title: '', priority: '일반', due_date: '', repeat_type: '', repeat_day: 1 });

    const filtered = todos.filter(t => {
        if (filter === 'done') return t.is_done;
        if (filter === 'all') return !t.is_done;
        return !t.is_done && t.priority === filter;
    });

    const pendingCount = todos.filter(t => !t.is_done).length;
    const urgentCount = todos.filter(t => !t.is_done && t.priority === '긴급').length;

    const handleToggleDone = async (id: string, is_done: boolean) => {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, is_done: !is_done } : t));
        await fetch('/api/tasks/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_done: !is_done }),
        });
    };

    const handleDelete = async (id: string) => {
        setTodos(prev => prev.filter(t => t.id !== id));
        await fetch('/api/tasks/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return alert('할 일 제목을 입력해주세요.');
        setIsSaving(true);
        try {
            const res = await fetch('/api/tasks/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, employee_email: userEmail }),
            });
            if (res.ok) {
                const data = await res.json();
                setTodos(prev => [data.todo, ...prev]);
                setShowForm(false);
                setForm({ title: '', priority: '일반', due_date: '', repeat_type: '', repeat_day: 1 });
            }
        } catch { alert('오류 발생'); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-5">
            {/* 요약 카드 */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <p className="text-xs font-bold text-slate-400">미완료</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{pendingCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
                    <p className="text-xs font-bold text-red-400">🔴 긴급</p>
                    <p className="text-3xl font-black text-red-600 mt-1">{urgentCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4">
                    <p className="text-xs font-bold text-emerald-400">완료</p>
                    <p className="text-3xl font-black text-emerald-600 mt-1">{todos.filter(t => t.is_done).length}</p>
                </div>
            </div>

            {/* 필터 + 추가 버튼 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
                    {(['all', '긴급', '일반', '낮음', 'done'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {f === 'all' ? '미완료 전체' : f === 'done' ? '완료됨' : f}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md hover:bg-slate-900 transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    할 일 추가
                </button>
            </div>

            {/* 추가 폼 */}
            {showForm && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">✏️ 새 할 일 추가</h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">할 일 제목 *</label>
                            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="예: 무신사 상품 재고 확인"
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">우선순위</label>
                                <div className="flex rounded-xl overflow-hidden border border-slate-200">
                                    {(['긴급', '일반', '낮음'] as const).map(p => (
                                        <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })}
                                            className={`flex-1 py-2 text-xs font-bold transition-colors ${form.priority === p ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                            {PRIORITY_CONFIG[p].icon} {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">마감 기한</label>
                                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                        {/* 반복 퀘스트 설정 */}
                        <div className="bg-white/70 rounded-xl p-4 space-y-3">
                            <p className="text-xs font-bold text-slate-600">🔄 반복 퀘스트 (선택)</p>
                            <div className="flex gap-2">
                                {(['', 'daily', 'weekly', 'monthly'] as const).map(rt => (
                                    <button key={rt} type="button" onClick={() => setForm({ ...form, repeat_type: rt })}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${form.repeat_type === rt ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                                        {rt === '' ? '반복 없음' : REPEAT_LABELS[rt]}
                                    </button>
                                ))}
                            </div>
                            {form.repeat_type === 'weekly' && (
                                <div className="flex gap-1.5">
                                    {WEEKDAYS.map((d, i) => (
                                        <button key={i} type="button" onClick={() => setForm({ ...form, repeat_day: i })}
                                            className={`w-9 h-9 rounded-full text-xs font-bold border transition-all ${form.repeat_day === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {form.repeat_type === 'monthly' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">매월</span>
                                    <input type="number" min={1} max={31} value={form.repeat_day}
                                        onChange={e => setForm({ ...form, repeat_day: Number(e.target.value) })}
                                        title="반복 날짜 (1-31)"
                                        className="w-16 border border-slate-200 rounded-lg p-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <span className="text-xs text-slate-500">일</span>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">취소</button>
                            <button type="submit" disabled={isSaving}
                                className="px-7 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95 disabled:bg-slate-400">
                                {isSaving ? '추가 중...' : '할 일 추가'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 할 일 목록 */}
            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <div className="text-center py-14 text-slate-400">
                        <p className="text-4xl mb-3">🎉</p>
                        <p className="text-sm font-bold">모든 할 일을 완료했어요!</p>
                    </div>
                ) : (
                    filtered.map(todo => {
                        const cfg = PRIORITY_CONFIG[todo.priority];
                        const isOverdue = todo.due_date && new Date(todo.due_date) < new Date() && !todo.is_done;
                        return (
                            <div key={todo.id}
                                className={`flex items-start gap-3 bg-white rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${todo.is_done ? 'opacity-50' : isOverdue ? 'border-red-200' : 'border-slate-100'}`}>
                                {/* 체크박스 */}
                                <button onClick={() => handleToggleDone(todo.id, todo.is_done)}
                                    title={todo.is_done ? '완료 취소' : '완료 처리'}
                                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${todo.is_done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                                    {todo.is_done && (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    )}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-sm font-semibold ${todo.is_done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                            {todo.repeat_type && <span className="mr-1">🔄</span>}
                                            {todo.title}
                                        </p>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                                            {cfg.icon} {todo.priority}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        {todo.due_date && (
                                            <span className={`text-[11px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                                📅 {todo.due_date} {isOverdue && '⚠️ 기한 초과'}
                                            </span>
                                        )}
                                        {todo.repeat_type && (
                                            <span className="text-[11px] text-indigo-500 font-medium">
                                                🔄 {REPEAT_LABELS[todo.repeat_type]}
                                                {todo.repeat_type === 'weekly' && ` (${WEEKDAYS[todo.repeat_day ?? 0]}요일)`}
                                                {todo.repeat_type === 'monthly' && ` (${todo.repeat_day}일)`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(todo.id)}
                                    title="삭제"
                                    className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
