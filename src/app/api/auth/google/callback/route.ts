import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google-calendar';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // /auth/google 라우트에서 보낸 employee_id

    if (!code || !state) {
        return NextResponse.json({ error: 'OAuth Callback Failed: Missing code or state' }, { status: 400 });
    }

    try {
        const oauth2Client = getGoogleOAuthClient();

        // 인가 코드로 엑세스 토큰 및 리프레시 토큰 교환
        const { tokens } = await oauth2Client.getToken(code);

        // Supabase DB 업데이트
        const supabaseAdmin = createSupabaseAdmin();

        const { error } = await supabaseAdmin
            .from('employees')
            .update({
                google_access_token: tokens.access_token,
                google_refresh_token: tokens.refresh_token || null, // 리프레시 토큰은 최초 consent 시에만 발급됨
                google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            })
            .eq('id', state);

        if (error) {
            console.error('Failed to update tokens to employee DB:', error);
            const redirectUrl = new URL('/hr/settings?error=db_update_failed', request.url);
            return NextResponse.redirect(redirectUrl);
        }

        // 연동 성공 후 사용자 세팅(프로필) 페이지로 리디렉트
        const successUrl = new URL('/hr/settings?calendar_connected=true', request.url);
        return NextResponse.redirect(successUrl);

    } catch (error: any) {
        console.error('Google OAuth Exchange Failed:', error);
        return NextResponse.json({ error: 'OAuth Token Exchange Failed', details: error.message }, { status: 500 });
    }
}
