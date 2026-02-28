import { createSupabaseServer } from '@/lib/supabase';

// 오늘 날짜의 프리오더 이벤트를 조회해서 팝업 알림을 렌더링
export default async function PreorderAlertWidget() {
    const supabase = await createSupabaseServer();

    const todayKST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD

    const { data: preorders } = await supabase
        .from('launch_calendar_events')
        .select('id, title, memo')
        .eq('event_date', todayKST)
        .eq('event_type', '프리오더');

    if (!preorders || preorders.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 w-80 space-y-2 pointer-events-none">
            {preorders.map(event => (
                <div key={event.id}
                    className="bg-white rounded-2xl shadow-2xl border border-orange-100 p-4 pointer-events-auto animate-bounce-in">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">📦</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-0.5">오늘 발송 예정!</p>
                            <p className="text-sm font-bold text-slate-800">{event.title}</p>
                            {event.memo && (
                                <p className="text-xs text-slate-500 mt-0.5">{event.memo}</p>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
