// src/lib/supabase.ts
// Supabase 클라이언트 — 서버/클라이언트 컴포넌트별 분리

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버 측에서 사용하는 Supabase Admin 클라이언트
 * Service Role Key를 사용하므로 RLS를 우회합니다.
 * API Routes, Server Components, Server Actions에서만 사용하세요.
 */
export function createSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('[Supabase 오류] SUPABASE URL 또는 SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}


/**
 * 서버 컴포넌트(Server Components)에서 사용하는 Supabase 클라이언트
 * 쿠키(Cookies)를 통해 현재 로그인된 사용자의 세션(토큰)을 가져옵니다.
 */
export async function createSupabaseServer() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const cookieStore = await cookies();

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('[Supabase 오류] SUPABASE URL 또는 ANON_KEY가 설정되지 않았습니다.');
    }

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Server Components에서 set은 에러가 날 수 있음 (응답 헤더 전송 후)
                }
            },
        },
    });
}
