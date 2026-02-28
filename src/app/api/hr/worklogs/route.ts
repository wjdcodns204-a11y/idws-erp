import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { employeeId, todayTask, tomorrowTask } = await request.json();

        if (!employeeId || !todayTask || !tomorrowTask) {
            return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

        // JSON stringify the dual texts
        const contentJson = JSON.stringify({ today: todayTask, tomorrow: tomorrowTask });

        const { error } = await supabase
            .from('daily_work_logs')
            .upsert({
                employee_id: employeeId,
                log_date: today,
                content: contentJson,
            }, { onConflict: 'employee_id,log_date' });

        if (error) {
            console.error('업무 일지 저장 실패:', error);
            return NextResponse.json({ error: 'DB 저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
