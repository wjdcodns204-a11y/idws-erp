import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import PlmBoardClient from './components/PlmBoardClient';

export default async function PlmPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    const { data: cards } = await supabase
        .from('plm_cards')
        .select('*')
        .order('sort_order', { ascending: true });

    return (
        <div className="max-w-full space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">신상품 PLM 보드</h1>
                <p className="text-slate-500 text-sm mt-1">기획부터 입고까지 신상품의 진행 단계를 관리합니다. 카드를 드래그해서 단계를 이동하세요.</p>
            </div>

            <PlmBoardClient initialCards={cards || []} />
        </div>
    );
}
