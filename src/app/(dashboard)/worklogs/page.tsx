import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import WorkLogBoard from './components/WorkLogBoard';

export default async function WorkLogsPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/');
    }

    const currentEmail = session.user.email;

    const { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', currentEmail)
        .single();

    if (userError || !currentUser) {
        return <div className="p-8 text-red-600">사용자 정보를 찾을 수 없습니다.</div>;
    }

    // Get today and yesterday date strings
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 최근 업무 일지 조회 (오늘, 어제 위주)
    // 원래는 content가 합쳐져있으므로 split해서 UI에 보여줌
    const { data: recentLogs } = await supabase
        .from('daily_work_logs')
        .select(`
            id,
            log_date,
            content,
            created_at,
            employee:employees ( id, name, department, role )
        `)
        .in('log_date', [today, yesterday])
        .order('created_at', { ascending: false });

    // 내가 오늘 작성한 일지가 있는지 판별
    const myTodayLog = recentLogs?.find(log => log.employee.id === currentUser.id && log.log_date === today);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">데일리 업무 일지</h1>
                <p className="text-slate-500 text-sm mt-1">오늘 하루 수고 많으셨습니다. 가볍게 오늘 한 일과 내일 할 일을 작성해주세요.</p>
            </div>

            <WorkLogBoard
                currentUser={currentUser}
                recentLogs={recentLogs || []}
                hasDraftedToday={!!myTodayLog}
                todayLogData={myTodayLog}
            />
        </div>
    );
}
