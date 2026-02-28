import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 연차 잔액 조회 (직원별 or 전체)
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const empId = searchParams.get('employee_id');

    let query = supabase
        .from('annual_leave_balance')
        .select(`*, employees(name, department, position)`)
        .eq('year', Number(year));

    if (empId) query = query.eq('employee_id', empId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 연차 잔액 생성/수정 (직원별 연도 upsert)
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    // 연차 자동 계산: 입사 1년 미만 = 월 1개, 1년 이상 = 15일 + 매 2년마다 +1 (최대 25일)
    let totalDays = body.total_days;
    if (!totalDays && body.employee_id) {
        const { data: emp } = await supabase
            .from('employees')
            .select('join_date')
            .eq('id', body.employee_id)
            .single();

        if (emp?.join_date) {
            const joinDate = new Date(emp.join_date);
            const targetYear = body.year || new Date().getFullYear();
            const monthsWorked = Math.floor(
                (new Date(targetYear, 11, 31).getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            const yearsWorked = Math.floor(monthsWorked / 12);

            if (yearsWorked < 1) {
                totalDays = Math.min(monthsWorked, 11); // 월 1일 최대 11일
            } else {
                totalDays = Math.min(15 + Math.floor((yearsWorked - 1) / 2), 25);
            }
        }
    }

    const { data, error } = await supabase
        .from('annual_leave_balance')
        .upsert({
            employee_id: body.employee_id,
            year: body.year || new Date().getFullYear(),
            total_days: totalDays || 15,
            used_days: body.used_days || 0,
            carry_over_days: body.carry_over_days || 0,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id,year' })
        .select(`*, employees(name, department, position)`)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
