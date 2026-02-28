import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { requestId, newStatus } = await request.json(); // newStatus = 'approved' | 'rejected'

        if (!requestId || !newStatus) {
            return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // 현재 휴가 신청서 조회
        const { data: requestData, error: requestError } = await supabase
            .from('leave_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (requestError || !requestData) {
            return NextResponse.json({ error: '휴가 신청 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (requestData.status !== 'pending') {
            return NextResponse.json({ error: '이미 처리된 건입니다.' }, { status: 400 });
        }

        // 트랜잭션과 유사하게 업데이트 진행 (Supabase JS 특성상 순차적 업데이트)
        // 먼저 상태 변경
        const { error: updateError } = await supabase
            .from('leave_requests')
            .update({ status: newStatus })
            .eq('id', requestId);

        if (updateError) {
            console.error('휴가 상태 업데이트 실패:', updateError);
            return NextResponse.json({ error: '상태 업데이트에 실패했습니다.' }, { status: 500 });
        }

        // 승인됨 + 연차/반차일 경우 연차 깎기 처리
        if (newStatus === 'approved' && (requestData.type === '연차' || requestData.type === '반차')) {
            // 사용 날짜 계산 로직 (시작일~종료일 차이)
            // 현재는 단순 데모 목적이므로 연차는 1, 반차는 0.5로 고정 처리 연습 
            // 실제 구현에서는 Math.abs(endDate - startDate) + 1 일 적용 필요. 임시로 아래와 같이 계산
            let deductAmount = 0;
            if (requestData.type === '연차') {
                const start = new Date(requestData.start_date);
                const end = new Date(requestData.end_date);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                deductAmount = diffDays;
            } else if (requestData.type === '반차') {
                deductAmount = 0.5;
            }

            // 직원 정보 가져와서 차감
            const { data: empData } = await supabase
                .from('employees')
                .select('annual_leave_used')
                .eq('id', requestData.employee_id)
                .single();

            if (empData) {
                await supabase
                    .from('employees')
                    .update({ annual_leave_used: empData.annual_leave_used + deductAmount })
                    .eq('id', requestData.employee_id);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
