// src/instrumentation.ts
// Next.js 서버 시작 시 실행되는 초기화 코드
// 이지어드민 자동 수집 스케줄러를 여기서 등록합니다

export async function register() {
    // 서버(Node.js) 측에서만 실행 (클라이언트 및 Edge 런타임에서는 무시)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const { startEzadminScheduler } = await import('@/services/ezadmin-scheduler');
            startEzadminScheduler();
        } catch (error) {
            console.warn('[instrumentation] 스케줄러 등록 실패:', error);
        }
    }
}
