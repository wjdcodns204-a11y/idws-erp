import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import CalendarClient from './components/CalendarClient';

export default async function CalendarPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    // 현재 월 ±1개월 이벤트 조회
    const startDate = `${year}-${String(month - 1 <= 0 ? 12 : month - 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-28`;

    const { data: events } = await supabase
        .from('launch_calendar_events')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true });

    // PLM 카드 중 target_date 있는 것들 → 자동으로 캘린더 점 표시용
    const { data: plmCards } = await supabase
        .from('plm_cards')
        .select('id, title, target_date, stage')
        .not('target_date', 'is', null)
        .gte('target_date', startDate)
        .lte('target_date', endDate);

    // 플랫폼 색상 정보
    const { data: platformFees } = await supabase
        .from('platform_fees')
        .select('platform_name, color');

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">런칭 캘린더</h1>
                <p className="text-slate-500 text-sm mt-1">신상품 런칭 및 이벤트 일정을 플랫폼별 색상으로 관리합니다.</p>
            </div>

            <CalendarClient
                initialEvents={events || []}
                plmCards={plmCards || []}
                platformFees={platformFees || []}
                initialYear={year}
                initialMonth={month}
            />
        </div>
    );
}
