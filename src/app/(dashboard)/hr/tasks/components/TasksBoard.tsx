"use client";

import React, { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-client';

type TaskType = {
    id: string;
    title: string;
    content: string;
    status: string;
    type: string;
    due_date: string;
    assignee?: { name: string };
    creator?: { name: string };
};

type EmployeeType = {
    id: string;
    name: string;
};

export default function TasksBoard({ initialTasks, employees }: { initialTasks: TaskType[], employees: EmployeeType[] }) {
    const [tasks, setTasks] = useState<TaskType[]>(initialTasks);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<TaskType | null>(null);

    type CommentType = {
        id: string;
        content: string;
        created_at: string;
        author: { name: string };
    };
    const [comments, setComments] = useState<CommentType[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    React.useEffect(() => {
        if (!selectedTask) {
            setComments([]);
            return;
        }

        const fetchComments = async () => {
            setIsLoadingComments(true);
            const supabase = createSupabaseBrowser();
            const { data, error } = await supabase
                .from('task_comments')
                .select('*, author:employees(name)')
                .eq('task_id', selectedTask.id)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setComments(data as unknown as CommentType[]);
            }
            setIsLoadingComments(false);
        };
        fetchComments();
    }, [selectedTask]);

    const handleAddComment = async () => {
        if (!newComment.trim() || !selectedTask) return;
        setIsSubmittingComment(true);
        try {
            const supabase = createSupabaseBrowser();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("로그인 유저 정보가 없습니다.");

            const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).single();
            if (!emp) throw new Error("직원 정보가 없습니다.");

            const { data: inserted, error } = await supabase.from('task_comments').insert({
                task_id: selectedTask.id,
                author_id: emp.id,
                content: newComment.trim()
            }).select('*, author:employees(name)').single();

            if (error) throw error;
            if (inserted) {
                setComments([...comments, inserted as unknown as CommentType]);
                setNewComment("");
            }
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const DAILY_REPORT_TEMPLATE = `[금일 진행 업무]\n- \n\n[내일 예정 업무]\n- \n\n[특이사항]\n- `;
    const WEEKLY_REPORT_TEMPLATE = `[이번 주 진행 목표 달성도]\n- \n\n[다음 주 핵심 목표]\n- \n\n[현안 및 건의사항]\n- `;

    // 새 업무 데이터 상태
    const [newTask, setNewTask] = useState({ title: '', type: '일반업무', assigneeId: '', content: '', dueDate: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        let newContent = newTask.content;

        if (newType === '일일보고' && (!newContent || newContent === WEEKLY_REPORT_TEMPLATE)) {
            newContent = DAILY_REPORT_TEMPLATE;
        } else if (newType === '주간보고' && (!newContent || newContent === DAILY_REPORT_TEMPLATE)) {
            newContent = WEEKLY_REPORT_TEMPLATE;
        } else if (newType === '일반업무' || newType === '공지사항') {
            if (newContent === DAILY_REPORT_TEMPLATE || newContent === WEEKLY_REPORT_TEMPLATE) {
                newContent = '';
            }
        }

        setNewTask({ ...newTask, type: newType, content: newContent });
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.title) return alert("제목을 입력해주세요.");
        setIsSubmitting(true);
        try {
            const supabase = createSupabaseBrowser();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("로그인 유저 정보가 없습니다.");

            const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).single();
            if (!emp) throw new Error("직원 매핑 정보가 없습니다.");

            const { data: insertedTask, error } = await supabase.from('tasks').insert({
                creator_id: emp.id,
                assignee_id: newTask.assigneeId || null,
                title: newTask.title,
                content: newTask.content,
                type: newTask.type,
                due_date: newTask.dueDate || null,
                status: '할일'
            }).select('*, creator:employees!tasks_creator_id_fkey(name), assignee:employees!tasks_assignee_id_fkey(name)').single();

            if (error) throw error;
            if (insertedTask) {
                setTasks([insertedTask, ...tasks]);
                setIsCreateModalOpen(false);
                setNewTask({ title: '', type: '일반업무', assigneeId: '', content: '', dueDate: '' });
            }
        } catch (error: unknown) {
            alert("업무 등록 중 오류: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSubmitting(false);
        }
    };

    // 칸반용 상태 분류
    const todoTasks = tasks.filter(t => t.status === '할일');
    const inProgressTasks = tasks.filter(t => t.status === '진행중');
    const doneTasks = tasks.filter(t => t.status === '완료');

    const renderKanbanColumn = (title: string, columnTasks: TaskType[], bgColor: string) => (
        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 flex flex-col h-full min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">{title} <span className="text-slate-400 font-normal ml-1">({columnTasks.length})</span></h3>
            </div>
            <div className="flex-1 space-y-3">
                {columnTasks.map(task => (
                    <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bgColor}`}>{task.type || '일반업무'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{task.due_date?.substring(5, 10)}</span>
                        </div>
                        <h4 className="text-sm font-medium text-slate-800 leading-snug">{task.title}</h4>
                        <div className="mt-4 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400">담당자</span>
                                <span className="text-xs text-slate-700 font-medium">{task.assignee?.name || '미지정'}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] text-slate-400">작성자</span>
                                <span className="text-xs text-slate-600">{task.creator?.name || '-'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[600px]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-800">업무 보드</h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`${viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'} px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer`}
                        >
                            칸반
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'} px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer`}
                        >
                            리스트
                        </button>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        + 새 업무 작성
                    </button>
                </div>
            </div>

            {viewMode === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    {renderKanbanColumn("할 일 (To Do)", todoTasks, "bg-slate-100 text-slate-700")}
                    {renderKanbanColumn("진행 중 (In Progress)", inProgressTasks, "bg-blue-100 text-blue-700")}
                    {renderKanbanColumn("완료 (Done)", doneTasks, "bg-emerald-100 text-emerald-700")}
                </div>
            ) : (
                <div className="overflow-x-auto mt-6">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-slate-500 bg-slate-50 border-y border-slate-200">
                            <tr>
                                <th className="px-4 py-3 font-medium">상태</th>
                                <th className="px-4 py-3 font-medium">유형</th>
                                <th className="px-4 py-3 font-medium">업무명</th>
                                <th className="px-4 py-3 font-medium">담당자</th>
                                <th className="px-4 py-3 font-medium">마감일</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tasks.map(t => (
                                <tr key={t.id} onClick={() => setSelectedTask(t)} className="hover:bg-slate-50 cursor-pointer">
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === '완료' ? 'bg-emerald-100 text-emerald-700' : t.status === '진행중' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{t.type}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{t.title}</td>
                                    <td className="px-4 py-3 text-slate-600">{t.assignee?.name || '미지정'}</td>
                                    <td className="px-4 py-3 text-slate-500">{t.due_date?.substring(0, 10) || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 업무 상세 조회 모달 */}
            {selectedTask && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate-100 text-slate-700">{selectedTask.type}</span>
                                <span className={`px-2.5 py-1 rounded text-xs font-bold ${selectedTask.status === '완료' ? 'bg-emerald-100 text-emerald-700' : selectedTask.status === '진행중' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{selectedTask.status}</span>
                            </div>
                            <button onClick={() => setSelectedTask(null)} title="닫기" className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedTask.title}</h2>
                                <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
                                    <div className="flex items-center gap-1.5 border border-slate-200 px-2 py-1 rounded-md">
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">작성자</span>
                                        <span className="font-semibold text-slate-700">{selectedTask.creator?.name || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 border border-slate-200 px-2 py-1 rounded-md bg-indigo-50/50 border-indigo-100">
                                        <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-wide">담당자</span>
                                        <span className="font-bold text-indigo-700">{selectedTask.assignee?.name || '미지정'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className={selectedTask.due_date ? 'font-medium text-slate-700' : ''}>{selectedTask.due_date?.substring(0, 10) || '마감일 없음'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100 min-h-[150px]">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">상세 내용</h3>
                                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                                    {selectedTask.content || '작성된 상세 내용이 없습니다.'}
                                </p>
                            </div>

                            <div className="border-t border-slate-100 pt-6">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    댓글 및 코멘트 ({comments.length})
                                </h3>

                                {isLoadingComments ? (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-slate-500">불러오는 중...</p>
                                    </div>
                                ) : comments.length > 0 ? (
                                    <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-2">
                                        {comments.map(c => (
                                            <div key={c.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-xs text-slate-700">{c.author?.name || '알 수 없음'}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-100 border-dashed mb-4">
                                        <p className="text-sm text-slate-500">아직 등록된 코멘트가 없습니다.</p>
                                    </div>
                                )}

                                <div className="mt-4 flex gap-2">
                                    <input
                                        type="text"
                                        title="코멘트 입력"
                                        placeholder="코멘트나 피드백을 남겨주세요..."
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        disabled={isSubmittingComment || !newComment.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {isSubmittingComment ? '등록 중' : '남기기'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 임시 모달 화면 디자인 */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">새 업무 등록</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} title="닫기" className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateTask}>
                            <div className="p-6 space-y-5 flex-1">
                                <div>
                                    <label htmlFor="task_title" className="block text-sm font-medium text-slate-700 mb-1">제목</label>
                                    <input id="task_title" title="제목" type="text" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="업무 제목을 입력하세요" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="task_type" className="block text-sm font-medium text-slate-700 mb-1">유형</label>
                                        <select id="task_type" title="업무 유형" value={newTask.type} onChange={handleTypeChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                                            <option value="일반업무">일반업무</option>
                                            <option value="일일보고">일일보고</option>
                                            <option value="주간보고">주간보고</option>
                                            <option value="공지사항">공지사항</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="task_assignee" className="block text-sm font-medium text-slate-700 mb-1">담당자 지정</label>
                                        <select id="task_assignee" title="담당자 지정" value={newTask.assigneeId} onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                                            <option value="">담당자 선택...</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="task_content" className="block text-sm font-medium text-slate-700 mb-1">내용 (이미지 첨부 가능)</label>
                                    <textarea id="task_content" title="내용" value={newTask.content} onChange={e => setNewTask({ ...newTask, content: e.target.value })} rows={6} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="업무 상세 내용 또는 보고 사항을 입력하세요..."></textarea>
                                </div>
                                <div>
                                    <label htmlFor="task_due_date" className="block text-sm font-medium text-slate-700 mb-1">마감일</label>
                                    <input id="task_due_date" title="마감일" type="date" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-50 cursor-pointer">취소</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-white bg-indigo-600 rounded-lg font-medium hover:bg-indigo-700 cursor-pointer disabled:opacity-50">
                                    {isSubmitting ? '등록 중...' : '등록하기'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
