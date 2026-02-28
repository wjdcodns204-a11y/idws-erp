import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import CsTrackerClient from './components/CsTrackerClient';

export default async function CsTrackerPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    const [{ data: csRequests }, { data: blacklist }] = await Promise.all([
        supabase
            .from('cs_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
        supabase
            .from('customer_blacklist')
            .select('id, customer_name, platform, reason')
            .order('created_at', { ascending: false }),
    ]);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">반품/교환 CS 관리</h1>
                <p className="text-slate-500 text-sm mt-1">반품·교환 요청 등록, 배송 추적, 채널별 현황, 블랙리스트를 관리합니다.</p>
            </div>
            <CsTrackerClient
                initialRequests={csRequests || []}
                initialBlacklist={blacklist || []}
            />
        </div>
    );
}
