export function parseTime(timeStr: string, baseDate: string) {
    if (!timeStr || timeStr.toString().trim() === '') return null;
    let t = timeStr.toString().trim();
    const d = new Date(baseDate);

    // 구글 시트 등에서 넘어오는 '오전/오후' 타임스탬프 처리
    // 예: "오후 2:37:00", "오전 9:28:00"
    if (t.includes('오전') || t.includes('오후')) {
        const isPM = t.includes('오후');
        const timePart = t.replace('오전', '').replace('오후', '').trim();
        const parts = timePart.split(':');
        if (parts.length >= 2) {
            let h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (isPM && h !== 12) h += 12;
            if (!isPM && h === 12) h = 0;

            t = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
    } else if (t.startsWith('+')) {
        // 기존 철야 로직 (+01:30 등)
        t = t.substring(1);
        d.setDate(d.getDate() + 1);
    } else {
        // "H:m" or "H:m:s" -> "HH:mm" 변환
        const parts = t.split(':');
        if (parts.length >= 2) {
            t = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
    }

    const dateStr = d.toISOString().split('T')[0];
    return `${dateStr}T${t}:00+09:00`;
}

export function calculateMinutesDifference(timeTarget: string, timeActual: string) {
    const [tH, tM] = timeTarget.split(':').map(Number);
    let [aH, aM] = [0, 0];

    // 기존의 + 기호 처리 방식 유지
    if (timeActual.startsWith('+')) {
        const [h, m] = timeActual.substring(1).split(':').map(Number);
        aH = h + 24;
        aM = m;
    } else {
        const [h, m] = timeActual.split(':').map(Number);
        aH = h;
        aM = m;
    }

    const targetMin = tH * 60 + tM;
    let actualMin = aH * 60 + aM;

    // 밤샘/새벽 퇴근의 경우 (예: 퇴근시간 오전 1시(01:00)이고 타겟시간이 오후 6시반(18:30)인 경우)
    // 실제 퇴근 시간이 타겟 시간보다 많이 작다면(예: 12시간 이상 차이), 익일 새벽 퇴근일 확률이 높음
    // 간단하게, actualH 가 0~6 사이이고, targetH 가 12 이상이면 익일 처리 (+24시간)
    if (aH >= 0 && aH < 9 && tH >= 12) {
        actualMin += 24 * 60;
    }

    return actualMin - targetMin;
}

export function isWeekendOrHoliday(dateStr: string): boolean {
    const d = new Date(dateStr);
    const day = d.getDay();
    // 0: Sunday, 6: Saturday
    if (day === 0 || day === 6) return true;

    // 2024~2026 주요 한국 공휴일 (대체 공휴일 포함)
    const holidays = [
        // 2024
        "2024-01-01", "2024-02-09", "2024-02-12", "2024-03-01", "2024-04-10", "2024-05-05", "2024-05-06",
        "2024-05-15", "2024-06-06", "2024-08-15", "2024-09-16", "2024-09-17", "2024-09-18", "2024-10-03",
        "2024-10-09", "2024-12-25",
        // 2025
        "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30", "2025-03-01", "2025-03-03",
        "2025-05-05", "2025-05-06", "2025-06-06", "2025-08-15", "2025-10-03", "2025-10-05",
        "2025-10-06", "2025-10-07", "2025-10-08", "2025-10-09", "2025-12-25",
        // 2026
        "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-01", "2026-03-02",
        "2026-05-05", "2026-05-24", "2026-05-25", "2026-06-06", "2026-08-15", "2026-08-17",
        "2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-09", "2026-12-25"
    ];

    return holidays.includes(dateStr);
}

export function calculateAttendanceStatus(
    dateStr: string,
    checkInTime: string | null,
    checkOutTime: string | null,
    checkInRaw: string,
    checkOutRaw: string,
    isHalfLeave: boolean = false
) {
    let status = '정상';
    let lateMinutes = 0;
    let overtimeMinutes = 0;

    // 0. 주말 및 공휴일 체크 (전체 근무시간을 연장근무로 처리)
    if (isWeekendOrHoliday(dateStr)) {
        status = '휴일근무';
        if (checkInTime && checkOutTime) {
            // 주말의 경우 타겟시간(checkInRaw)이 기준이 됨.
            let workedMinutes = calculateMinutesDifference(checkInRaw, checkOutRaw);

            // 만약 주말 오전에 출근해서 익일 오전에 퇴근한 경우 보정 로직
            const [cH] = checkOutRaw.split(':').map(Number);
            const [iH] = checkInRaw.split(':').map(Number);
            if (workedMinutes < 0 && cH >= 0 && cH < 9 && iH >= 9) {
                workedMinutes += 24 * 60;
            }

            if (workedMinutes > 0) {
                overtimeMinutes = workedMinutes;
            }
        } else {
            status = '이상처리'; // 휴일인데 출퇴근 기록 하나가 누락된 경우
        }
        return { status, lateMinutes, overtimeMinutes };
    }

    // 1. 평일 출근 로직 (09:30 기준)
    if (checkInTime) {
        const checkInDiff = calculateMinutesDifference("09:30", checkInRaw);
        if (checkInDiff > 0) {
            status = '지각';
            lateMinutes = checkInDiff;
        } else if (checkInDiff < 0) {
            // 조기 출근분 연장근무 합산
            overtimeMinutes += Math.abs(checkInDiff);
        }
    } else {
        status = '확인중'; // 출근 기록 없음
    }

    // 2. 기준 퇴근 시간 (반차면 14:30)
    const baseCheckOutTime = isHalfLeave ? "14:30" : "18:30";

    // 3. 퇴근 로직
    if (checkOutTime) {
        const checkOutDiff = calculateMinutesDifference(baseCheckOutTime, checkOutRaw);

        if (checkOutDiff > 0) {
            // 기준시간 이후 퇴근 -> 늦은 만큼 연장근무 합산
            overtimeMinutes += checkOutDiff;
        } else if (checkOutDiff < 0) {
            // 기준시간 이전 조기 퇴근 -> 이상처리
            if (status === '정상' || status === '지각') {
                status = '이상처리';
            }
        }
    } else if (status === '정상' || status === '지각') {
        // 출근 기록은 있는데 퇴근 기록이 없는 경우
        status = '이상처리';
    }

    return { status, lateMinutes, overtimeMinutes };
}
