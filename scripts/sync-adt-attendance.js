require('dotenv').config({ path: 'C:\\IDWS_ERP\\.env' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const DOWNLOAD_DIR = 'C:\\Caps\\ACServer\\Download';

function parseTime(timeStr, baseDate) {
    if (!timeStr || timeStr.toString().trim() === '') return null;
    let t = timeStr.toString().trim();
    let d = new Date(baseDate);

    // 심야 대근/연장의 경우 +00:51 처럼 넘어오는 ADT캡스 엑셀 포맷 예외처리
    if (t.startsWith('+')) {
        t = t.substring(1); // '+' 제거
        d.setDate(d.getDate() + 1); // 다음날로 설정
    }

    const dateStr = d.toISOString().split('T')[0];
    return `${dateStr}T${t}:00+09:00`;
}

function calculateMinutesDifference(timeTarget, timeActual) {
    // timeTarget: "09:30", timeActual: "09:40" 또는 "+01:30"
    // 반환값: 분 차이 (actual - target)
    const [tH, tM] = timeTarget.split(':').map(Number);
    let aH = 0, aM = 0;

    if (timeActual.startsWith('+')) {
        const [h, m] = timeActual.substring(1).split(':').map(Number);
        aH = h + 24; // 다음날이므로 24시간 추가
        aM = m;
    } else {
        const [h, m] = timeActual.split(':').map(Number);
        aH = h;
        aM = m;
    }

    const targetMin = tH * 60 + tM;
    const actualMin = aH * 60 + aM;

    return actualMin - targetMin;
}

async function syncAttendance() {
    console.log(`Starting ADT Caps Attendance Sync from ${DOWNLOAD_DIR}...`);

    const { data: employees, error: empError } = await supabase.from('employees').select('id, name');
    if (empError) {
        console.error('Failed to fetch employees:', empError);
        return;
    }

    const empMap = {};
    employees.forEach(emp => {
        empMap[emp.name] = emp.id;
    });

    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
    console.log(`Found ${files.length} excel files.`);

    let totalUpserted = 0;

    for (const file of files) {
        const filePath = path.join(DOWNLOAD_DIR, file);

        try {
            const buffer = fs.readFileSync(filePath);
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            const rows = data.slice(1);
            const recordsToInsert = [];

            for (const row of rows) {
                // columns: 0:번호, 1:ID, 2:부서, 3:직급, 4:이름, 5:근무일자, 6:출근, 7:퇴근, 8:지각 등등
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

                let status = '정상';
                let lateMinutes = 0;
                let overtimeMinutes = 0;

                // 지각 계산 (09:30 기준)
                if (checkInTime) {
                    const diff = calculateMinutesDifference("09:30", checkIn);
                    if (diff > 0) {
                        status = '지각';
                        lateMinutes = diff;
                    }
                } else {
                    status = '확인중'; // 출근 기록이 없는 경우
                }

                // 연장근무 계산 (18:30 기준)
                if (checkOutTime) {
                    const diff = calculateMinutesDifference("18:30", checkOut);
                    if (diff > 0) {
                        overtimeMinutes = diff;
                    }
                }

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
                    console.error(`Error upserting data from ${file}:`, upsertError);
                } else {
                    totalUpserted += recordsToInsert.length;
                }
            }

        } catch (e) {
            console.error(`Failed to process ${file}:`, e.message);
        }
    }

    console.log(`Sync complete! Total records upserted: ${totalUpserted}`);
}

syncAttendance();
