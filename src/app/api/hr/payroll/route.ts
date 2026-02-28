import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 급여 목록 조회 (월별)
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const yearMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    const { data, error } = await supabase
        .from('payroll_records')
        .select(`
            *,
            employees(name, department, position)
        `)
        .eq('year_month', yearMonth)
        .order('created_at');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 급여 생성/수정 (upsert)
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data, error } = await supabase
        .from('payroll_records')
        .upsert({
            employee_id: body.employee_id,
            year_month: body.year_month,
            base_salary: body.base_salary || 0,
            performance_bonus: body.performance_bonus || 0,
            overtime_pay: body.overtime_pay || 0,
            meal_allowance: body.meal_allowance ?? 30000,
            transport_allowance: body.transport_allowance || 0,
            income_tax: body.income_tax || 0,
            memo: body.memo || null,
            paid_at: body.paid_at || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id,year_month' })
        .select(`*, employees(name, department, position)`)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
