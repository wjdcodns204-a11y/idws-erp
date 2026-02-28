import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import InventoryChangeLogClient from './components/InventoryChangeLogClient';

export default async function InventoryChangeLogPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    // 최근 변동 로그 50건 조회
    const { data: logs } = await supabase
        .from('inventory_change_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">재고 변동 로그</h1>
                <p className="text-slate-500 text-sm mt-1">출고, 반품, 불량 처리 등 재고 변동 사유를 기록합니다.</p>
            </div>

            <InventoryChangeLogClient logs={logs || []} />
        </div>
    );
}
