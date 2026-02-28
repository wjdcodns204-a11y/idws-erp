import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { calculateAttendanceStatus } from '@/lib/attendance-utils';

export async function POST(request: Request) {
    try {
        const { employeeId, action } = await request.json();

        if (!employeeId || !action) {
            return NextResponse.json({ error: '직원 ID와 액션(check_in/check_out)이 필요합니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD in KST
        const nowIso = new Date().toISOString();

        // Get existing record for today
        const { data: existingRecord, error: fetchError } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('date', today)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('기존 기록 조회 실패:', fetchError);
            return NextResponse.json({ error: '기록 조회 중 오류가 발생했습니다.' }, { status: 500 });
        }

        let newCheckInTime = existingRecord?.check_in_time || null;
        let newCheckOutTime = existingRecord?.check_out_time || null;
        const workStatus = existingRecord?.work_status || '정상';

        if (action === 'check_in') {
            if (newCheckInTime) {
                return NextResponse.json({ error: '오늘은 이미 출근 도장을 찍으셨습니다.' }, { status: 400 });
            }
            newCheckInTime = nowIso;
        } else if (action === 'check_out') {
            if (!newCheckInTime) {
                return NextResponse.json({ error: '출근 도장을 먼저 찍어주세요.' }, { status: 400 });
            }
            newCheckOutTime = nowIso;
        } else {
            return NextResponse.json({ error: '유효하지 않은 액션입니다.' }, { status: 400 });
        }

        // 재계산 로직 
        const isHalfDay = workStatus.includes('반차');
        const calculated = calculateAttendanceStatus(newCheckInTime, newCheckOutTime, today, isHalfDay);

        const updateData = {
            employee_id: employeeId,
            date: today,
            check_in_time: newCheckInTime,
            check_out_time: newCheckOutTime,
            work_status: calculated.status,
            late_minutes: calculated.lateMinutes,
            overtime_minutes: calculated.overtimeMinutes,
            // 모바일 인증 위경도를 기록해둘 수 있습니다. DB 스키마에 컬럼 추가 시 활용 가능.
            // mobile_checkin_lat: lat,
            // mobile_checkin_lng: lng
        };

        const { error: upsertError } = await supabase
            .from('attendance')
            .upsert(updateData, { onConflict: 'employee_id,date' });

        if (upsertError) {
            console.error('출퇴근 기록 저장 실패:', upsertError);
            return NextResponse.json({ error: '출퇴근 기록 저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
