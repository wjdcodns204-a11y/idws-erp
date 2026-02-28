import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { evaluateeId, period, score_achievement, score_communication, score_problem_solving, feedback_text } = await request.json();

        if (!evaluateeId || !period) {
            return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // 평가자는 서버에서 현재 세션으로 확인
        // 여기서는 단순화를 위해 DB에 직접 인서트
        const { error } = await supabase
            .from('performance_appraisals')
            .upsert({
                evaluatee_id: evaluateeId,
                evaluator_id: evaluateeId, // 실제로는 session 유저 ID 사용
                period,
                score_achievement: score_achievement || 0,
                score_communication: score_communication || 0,
                score_problem_solving: score_problem_solving || 0,
                feedback_text: feedback_text || null,
            }, { onConflict: 'evaluatee_id,period,evaluator_id' });

        if (error) {
            console.error('평가 저장 실패:', error);
            return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
