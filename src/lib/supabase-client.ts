import { createBrowserClient } from '@supabase/ssr';

/**
 * 클라이언트 측에서 사용하는 Supabase 클라이언트
 * Anon Key를 사용하며 RLS가 적용되고 쿠키에 세션을 저장합니다.
 */
export function createSupabaseBrowser() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('[Supabase 오류] SUPABASE URL 또는 ANON_KEY가 설정되지 않았습니다.');
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
