import React from 'react';
import { createSupabaseAdmin } from '@/lib/supabase';
import TasksBoard from './components/TasksBoard';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
    const supabaseAdmin = createSupabaseAdmin();

    const [tasksRes, employeesRes] = await Promise.all([
        supabaseAdmin
            .from('tasks')
            .select(`
                *,
                creator:employees!tasks_creator_id_fkey(name),
                assignee:employees!tasks_assignee_id_fkey(name)
            `)
            .order('created_at', { ascending: false }),
        supabaseAdmin
            .from('employees')
            .select('id, name')
            .eq('status', 'active')
            .order('name')
    ]);

    if (tasksRes.error || employeesRes.error) {
        return <div className="p-4 text-red-500">데이터를 불러오는 중 오류가 발생했습니다.</div>;
    }

    return (
        <TasksBoard
            initialTasks={tasksRes.data || []}
            employees={employeesRes.data || []}
        />
    );
}
