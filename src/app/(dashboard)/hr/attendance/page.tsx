import React from 'react';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import AttendanceDashboardClient from './components/AttendanceDashboardClient';

export const dynamic = 'force-dynamic';

// ★ 전체 조회 권한이 있는 관리자 이메일 (정채운)
const ADMIN_EMAIL = 'wjdcodns204@idontwannasell.com';

export default async function AttendancePage() {
    const supabaseAdmin = createSupabaseAdmin();
    const supabaseServer = await createSupabaseServer();

    // 1. 현재 접속 중인 사용자 확인
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) redirect('/login');

    const currentUserEmail = user.email || '';
    const isAdmin = currentUserEmail === ADMIN_EMAIL;

    // 2. 현재 사용자의 employees ID 조회
    let currentEmployeeId = '';
    if (currentUserEmail) {
        const { data: emp } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('email', currentUserEmail)
            .single();
        if (emp) currentEmployeeId = emp.id;
    }

    // 3. 근태 기록 조회 — 관리자는 전체, 일반 직원은 본인 것만
    let query = supabaseAdmin
        .from('attendance')
        .select(`
            *,
            employee:employees(id, name, department)
        `)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: true });

    // ★ 핵심: 비관리자는 서버에서 본인 ID로 필터링 (데이터 자체를 안 내려보냄)
    if (!isAdmin && currentEmployeeId) {
        query = query.eq('employee_id', currentEmployeeId);
    }

    const { data: attendanceList, error } = await query;

    if (error) {
        return <div className="p-4 text-red-500">데이터를 불러오는 중 오류가 발생했습니다: {error.message}</div>;
    }

    return (
        <AttendanceDashboardClient
            attendanceData={attendanceList || []}
            currentEmployeeId={currentEmployeeId}
            isAdmin={isAdmin}
        />
    );
}
