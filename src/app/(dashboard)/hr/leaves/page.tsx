import React from 'react';
import { createSupabaseAdmin } from '@/lib/supabase';
import LeavesClient from './components/LeavesClient';

export const dynamic = 'force-dynamic';

export default async function LeavesPage() {
    const supabaseAdmin = createSupabaseAdmin();

    const { data: leavesList, error } = await supabaseAdmin
        .from('leaves')
        .select(`
            *,
            employee:employees!leaves_employee_id_fkey(name, department)
        `)
        .order('start_date', { ascending: false });

    if (error) {
        return <div className="p-4 text-red-500">데이터를 불러오는 중 오류가 발생했습니다: {error.message}</div>;
    }

    return <LeavesClient initialLeaves={leavesList || []} />;
}
