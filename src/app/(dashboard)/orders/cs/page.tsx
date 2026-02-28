import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import CsTrackerClient from './components/CsTrackerClient';

export default async function CsTrackerPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    const { data: csRequests } = await supabase
        .from('cs_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">반품/교환 CS 관리</h1>
                <p className="text-slate-500 text-sm mt-1">반품·교환 요청을 등록하고 처리 상태를 추적합니다.</p>
            </div>
            <CsTrackerClient initialRequests={csRequests || []} />
        </div>
    );
}
