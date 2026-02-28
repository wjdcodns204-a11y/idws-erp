"use client";

import React, { useState } from 'react';

const STAGES = ['기획', '디자인', '1차 투입', '2차 투입', '생산의뢰', '부자재 발주', '입고'] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<Stage, string> = {
    '기획': 'bg-slate-100 text-slate-700',
    '디자인': 'bg-purple-100 text-purple-700',
    '1차 투입': 'bg-blue-100 text-blue-700',
    '2차 투입': 'bg-indigo-100 text-indigo-700',
    '생산의뢰': 'bg-amber-100 text-amber-700',
    '부자재 발주': 'bg-orange-100 text-orange-700',
    '입고': 'bg-emerald-100 text-emerald-700',
};

type Card = {
    id: string;
    title: string;
    stage: Stage;
    assignee?: string;
    target_date?: string;
    memo?: string;
    style_code?: string;
};

export default function PlmBoardClient({ initialCards }: { initialCards: Card[] }) {
    const [cards, setCards] = useState<Card[]>(initialCards);
    const [showForm, setShowForm] = useState(false);
    const [dragCard, setDragCard] = useState<string | null>(null);
    const [newCard, setNewCard] = useState({ title: '', stage: '기획' as Stage, assignee: '', target_date: '', memo: '', style_code: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleDragStart = (id: string) => setDragCard(id);
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = async (targetStage: Stage) => {
        if (!dragCard) return;
        const prevCards = [...cards];
        const updated = cards.map(c => c.id === dragCard ? { ...c, stage: targetStage } : c);
        setCards(updated);
        setDragCard(null);

        try {
            await fetch('/api/plm/update-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: dragCard, stage: targetStage }),
            });
        } catch {
            setCards(prevCards); // rollback
        }
    };

    const handleAddCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCard.title.trim()) return alert('카드 제목을 입력해주세요.');
        setIsSaving(true);
        try {
            const res = await fetch('/api/plm/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCard),
            });
            if (res.ok) {
                const data = await res.json();
                setCards(prev => [...prev, data.card]);
                setShowForm(false);
                setNewCard({ title: '', stage: '기획', assignee: '', target_date: '', memo: '', style_code: '' });
            } else {
                alert('저장에 실패했습니다.');
            }
        } catch {
            alert('오류 발생');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Add card button */}
            <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">총 {cards.length}개 신상품 카드</p>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-md transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    신상품 카드 추가
                </button>
            </div>

            {/* New Card Form */}
            {showForm && (
                <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">✨ 새 상품 카드 추가</h3>
                    <form onSubmit={handleAddCard} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="col-span-2 md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">상품명/카드 제목 *</label>
                            <input type="text" value={newCard.title} onChange={e => setNewCard({ ...newCard, title: e.target.value })}
                                placeholder="예: 26SS 오버핏 롱코트"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">스타일 코드</label>
                            <input type="text" value={newCard.style_code} onChange={e => setNewCard({ ...newCard, style_code: e.target.value })}
                                placeholder="예: I26SSDP003"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">담당자</label>
                            <input type="text" value={newCard.assignee} onChange={e => setNewCard({ ...newCard, assignee: e.target.value })}
                                placeholder="담당자명"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">목표 완료일</label>
                            <input type="date" value={newCard.target_date} onChange={e => setNewCard({ ...newCard, target_date: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">메모</label>
                            <input type="text" value={newCard.memo} onChange={e => setNewCard({ ...newCard, memo: e.target.value })}
                                placeholder="특이사항, 주의사항 등"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="col-span-2 md:col-span-3 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">취소</button>
                            <button type="submit" disabled={isSaving}
                                className="px-7 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-slate-400">
                                {isSaving ? '저장 중...' : '카드 만들기'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Kanban Board */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {STAGES.map(stage => {
                        const stageCards = cards.filter(c => c.stage === stage);
                        return (
                            <div key={stage}
                                className="w-64 bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col gap-3"
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(stage)}>
                                {/* Column header */}
                                <div className="flex items-center justify-between px-1">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STAGE_COLORS[stage]}`}>{stage}</span>
                                    <span className="text-xs text-slate-400 font-semibold">{stageCards.length}</span>
                                </div>
                                {/* Cards */}
                                <div className="space-y-2 min-h-[80px]">
                                    {stageCards.map(card => (
                                        <div key={card.id}
                                            draggable
                                            onDragStart={() => handleDragStart(card.id)}
                                            className={`bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:-translate-y-0.5 ${dragCard === card.id ? 'opacity-50 scale-95' : ''}`}>
                                            {card.style_code && (
                                                <p className="text-[10px] font-mono text-slate-400 mb-1">{card.style_code}</p>
                                            )}
                                            <p className="text-sm font-bold text-slate-800 leading-snug">{card.title}</p>
                                            {card.assignee && (
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center">
                                                        {card.assignee.charAt(0)}
                                                    </div>
                                                    <span className="text-xs text-slate-500">{card.assignee}</span>
                                                </div>
                                            )}
                                            {card.target_date && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                                                    </svg>
                                                    <span className="text-[10px] text-slate-400">{card.target_date}</span>
                                                </div>
                                            )}
                                            {card.memo && (
                                                <p className="text-[10px] text-slate-400 mt-1.5 italic truncate">{card.memo}</p>
                                            )}
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
