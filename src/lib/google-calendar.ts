import { google } from 'googleapis';

export function getGoogleOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // 로컬 환경과 프로덕션 환경에 따른 리디렉션 URL 자동 설정
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
}

// 사용자 리포지토리 또는 DB에 캘린더 일정을 쓰는 유틸리티 함수들을 나중에 여기에 추가할 수 있습니다.
export async function getCalendarClient(tokens: any) {
    const oauth2Client = getGoogleOAuthClient();
    oauth2Client.setCredentials(tokens);
    return google.calendar({ version: 'v3', auth: oauth2Client });
}
