import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import * as xlsx from 'xlsx';
import { parseTime, calculateAttendanceStatus } from '@/lib/attendance-utils';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const supabase = createSupabaseAdmin();
        const { data: employees, error: empError } = await supabase.from('employees').select('id, name');

        if (empError) {
            return NextResponse.json({ error: '직원 정보를 불러오는데 실패했습니다.' }, { status: 500 });
        }

        const empMap: Record<string, string> = {};
        employees.forEach(emp => {
            empMap[emp.name] = emp.id;
        });

        // 당일 기준 승인된 반차 휴가 내역 미리 조회
        // (업로드 데이터의 날짜 범위 내에서 조회하는 것이 이상적이나, 편의상 향후 최적화를 위해 일단 전체를 가볍게 가져옵니다)
        const { data: approvedLeaves, error: leavesError } = await supabase
            .from('leaves')
            .select('employee_id, start_date, type')
            .eq('status', '승인됨');

        if (leavesError) {
            console.error("휴가 내역 조회 실패:", leavesError);
        }

        const rows = data.slice(1) as Array<Array<string | number | undefined | null>>;
        const recordsToInsert = [];

        for (const row of rows) {
            const rawName = row[4] ? row[4].toString().trim() : "";
            const rawDate = row[5] ? row[5].toString().trim() : "";
            const checkIn = row[6] ? row[6].toString().trim() : "";
            const checkOut = row[7] ? row[7].toString().trim() : "";

            if (!rawName || !rawDate) continue;

            const dbDate = rawDate.replace(/\//g, '-');
            const employeeId = empMap[rawName];

            if (!employeeId) continue;

            const checkInTime = parseTime(checkIn, dbDate);
            const checkOutTime = parseTime(checkOut, dbDate);

            let isHalfLeave = false;
            if (approvedLeaves) {
                isHalfLeave = approvedLeaves.some(
                    leave => leave.employee_id === employeeId && leave.start_date === dbDate && leave.type === '반차'
                );
            }

            // 계산을 위해 24시간제 HH:mm 형식으로 통일된 값을 추출 (오전/오후 제거된 값)
            const checkInRaw = checkInTime ? checkInTime.split('T')[1].substring(0, 5) : "";
            const checkOutRaw = checkOutTime ? checkOutTime.split('T')[1].substring(0, 5) : "";

            const { status, lateMinutes, overtimeMinutes } = calculateAttendanceStatus(
                dbDate,
                checkInTime,
                checkOutTime,
                checkInRaw,
                checkOutRaw,
                isHalfLeave
            );

            recordsToInsert.push({
                employee_id: employeeId,
                date: dbDate,
                check_in_time: checkInTime,
                check_out_time: checkOutTime,
                work_status: status,
                late_minutes: lateMinutes,
                overtime_minutes: overtimeMinutes,
                updated_at: new Date().toISOString()
            });
        }

        if (recordsToInsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('attendance')
                .upsert(recordsToInsert, { onConflict: 'employee_id, date' });

            if (upsertError) {
                return NextResponse.json({ error: 'DB 저장 실패: ' + upsertError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, count: recordsToInsert.length });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "알 수 없는 에러";
        return NextResponse.json({ error: '업로드 처리 중 오류 발생: ' + msg }, { status: 500 });
    }
}
