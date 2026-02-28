import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import TodoPageClient from './components/TodoPageClient';

export default async function TasksPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    // 이 직원의 To-do 목록 조회 (미완료 + 오늘 기준 반복 퀘스트 포함)
    const { data: todos } = await supabase
        .from('todos')
        .select('*')
        .eq('employee_email', session.user.email)
        .order('is_done', { ascending: true })
        .order('priority', { ascending: true }) // 긴급 → 일반 → 낮음
        .order('due_date', { ascending: true });

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">내 할 일 (To-do)</h1>
                <p className="text-slate-500 text-sm mt-1">오늘의 업무를 관리하세요. 반복 퀘스트는 🔄 아이콘으로 표시됩니다.</p>
            </div>
            <TodoPageClient initialTodos={todos || []} userEmail={session.user.email || ''} />
        </div>
    );
}
