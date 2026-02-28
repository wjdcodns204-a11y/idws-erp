import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google-calendar';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    // 1. 사용자 인증 확인 (Supabase)
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) { /* ignore for read-only */ },
        },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 구글 OAuth 클라이언트 생성
    const oauth2Client = getGoogleOAuthClient();

    // 3. 권한 스코프 (캘린더 일정 읽기/쓰기 권한 등)
    const scopes = [
        'https://www.googleapis.com/auth/calendar.events'
    ];

    // 4. 구글 로그인 URL 가져오기
    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // refresh_token을 명시적으로 요청
        scope: scopes,
        prompt: 'consent', // 항상 동의 화면을 띄워 refresh_token 재발급 유도
        state: user.id // 현재 유저의 ID를 state로 전달해서 콜백에서 식별
    });

    // 5. 로그인 URL로 리디렉션
    return NextResponse.redirect(authorizationUrl);
}
