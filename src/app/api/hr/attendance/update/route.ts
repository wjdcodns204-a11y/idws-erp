import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { calculateAttendanceStatus } from '@/lib/attendance-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, employee_id, date, check_in_time, check_out_time } = body;

        if (!id) {
            return NextResponse.json({ error: '필수 파라미터(id)가 누락되었습니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // 1. 해당 날짜 '반차' 여부 조회
        let isHalfLeave = false;
        if (employee_id && date) {
            const { data: leaves } = await supabase
                .from('leaves')
                .select('id')
                .eq('employee_id', employee_id)
                .eq('start_date', date)
                .eq('type', '반차')
                .eq('status', '승인됨')
                .single();
            if (leaves) {
                isHalfLeave = true;
            }
        }

        // 2. 입력된 시간 데이터를 포맷에 맞게 시간(HH:mm) 문자열만 추출
        // 입력은 2026-02-24T09:30:00+09:00 형식으로 오므로 'T' 이후 5자리 추출
        const checkInRaw = check_in_time ? check_in_time.split('T')[1].substring(0, 5) : "";
        const checkOutRaw = check_out_time ? check_out_time.split('T')[1].substring(0, 5) : "";

        // 3. 지각 및 연장근무 시간 등 자동 산정
        const { status: work_status, lateMinutes: late_minutes, overtimeMinutes: overtime_minutes } = calculateAttendanceStatus(
            date,
            check_in_time,
            check_out_time,
            checkInRaw,
            checkOutRaw,
            isHalfLeave
        );

        // 4. 업데이트 실행
        const { data, error } = await supabase
            .from('attendance')
            .update({
                check_in_time,
                check_out_time,
                work_status,
                late_minutes,
                overtime_minutes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'DB 수정 실패: ' + error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "알 수 없는 오류";
        return NextResponse.json({ error: '수정 처리 중 오류 발생: ' + msg }, { status: 500 });
    }
}
