// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
    let res = NextResponse.next({
        request: { headers: req.headers },
    });

    const PUBLIC_PATHS = ['/login', '/api/auth', '/api/webhook', '/api/hr/setup-users'];

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res;
        }

        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
                    res = NextResponse.next({ request: req });
                    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
                },
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        const { pathname } = req.nextUrl;

        // 정적 리소스 등은 제외
        const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

        if (!user && !isPublicPath) {
            const loginUrl = new URL('/login', req.url);
            loginUrl.searchParams.set('redirectTo', pathname);
            return NextResponse.redirect(loginUrl);
        }

        if (user && pathname === '/login') {
            return NextResponse.redirect(new URL('/', req.url));
        }
    } catch (error) {
        console.error('[미들웨어 오류] 인증 확인 실패:', error);
    }

    return res;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
