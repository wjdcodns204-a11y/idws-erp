import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 면담 기록 조회
export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const empId = searchParams.get('employee_id');

    let query = supabase
        .from('interview_records')
        .select(`*, employees!interview_records_employee_id_fkey(name, department)`)
        .order('interview_date', { ascending: false });

    if (empId) query = query.eq('employee_id', empId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// 면담 기록 생성
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();
    const { data: { session } } = await supabase.auth.getSession();
    const { data: interviewer } = await supabase
        .from('employees').select('id').eq('email', session?.user?.email || '').maybeSingle();

    const { data, error } = await supabase
        .from('interview_records')
        .insert({
            employee_id: body.employee_id,
            interviewer_id: interviewer?.id || null,
            interview_date: body.interview_date,
            type: body.type || '정기면담',
            content: body.content,
            action_items: body.action_items || null,
            next_date: body.next_date || null,
            is_confidential: body.is_confidential ?? true,
        })
        .select(`*, employees!interview_records_employee_id_fkey(name, department)`)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
