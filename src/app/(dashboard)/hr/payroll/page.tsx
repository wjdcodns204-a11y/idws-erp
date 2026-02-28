import { createSupabaseServer } from '@/lib/supabase';
import PayrollClient from './PayrollClient';

export default async function PayrollPage() {
    const supabase = await createSupabaseServer();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentYear = new Date().getFullYear();

    const [
        { data: employees },
        { data: payrolls },
        { data: leaveBalances },
        { data: interviews },
    ] = await Promise.all([
        supabase.from('employees').select('id, name, department, position, join_date').eq('status', 'active').order('name'),
        supabase.from('payroll_records').select(`*, employees(name, department, position)`).eq('year_month', currentMonth),
        supabase.from('annual_leave_balance').select(`*, employees(name, department, join_date)`).eq('year', currentYear),
        supabase.from('interview_records').select(`*, employees!interview_records_employee_id_fkey(name, department)`).order('interview_date', { ascending: false }).limit(50),
    ]);

    return (
        <PayrollClient
            employees={employees || []}
            initialPayrolls={payrolls || []}
            initialLeaveBalances={leaveBalances || []}
            initialInterviews={interviews || []}
            currentMonth={currentMonth}
            currentYear={currentYear}
        />
    );
}
