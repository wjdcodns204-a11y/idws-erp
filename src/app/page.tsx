import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase';

// 루트 URL(/)에 접속하면 로그인 여부에 따라 분기
export default async function RootPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    // 로그인 상태면 대시보드로, 아니면 로그인 페이지로
    if (session) {
        redirect('/dashboard');
    } else {
        redirect('/login');
    }
}
