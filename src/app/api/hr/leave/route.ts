import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { employeeId, type, startDate, endDate, reason } = await request.json();

        if (!employeeId || !type || !startDate || !endDate) {
            return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        const { error } = await supabase
            .from('leave_requests')
            .insert({
                employee_id: employeeId,
                type,
                start_date: startDate,
                end_date: endDate,
                reason: reason || null,
                status: 'pending'
            });

        if (error) {
            console.error('휴가 신청 실패:', error);
            return NextResponse.json({ error: 'DB 저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
