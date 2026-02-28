import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, priority, due_date, repeat_type, repeat_day, employee_email } = body;
        if (!title || !employee_email) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { data: todo, error } = await supabase
            .from('todos')
            .insert({
                title, priority: priority || '일반',
                due_date: due_date || null,
                repeat_type: repeat_type || null,
                repeat_day: repeat_type ? repeat_day : null,
                employee_email,
            })
            .select().single();

        if (error) return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
        return NextResponse.json({ success: true, todo });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
