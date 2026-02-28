// src/services/ezadmin-scheduler.ts
// 이지어드민 자동 수집 스케줄러 — 매일 오전 9시 30분에 주문 수집
// Next.js instrumentation에서 import하여 서버 시작 시 자동 등록

import cron from 'node-cron';

const API_BASE = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// 내부 API 호출 함수
async function callScrapeAPI(type: 'stock' | 'orders') {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log(`[스케줄러] ${now} — ${type === 'stock' ? '재고' : '주문'} 수집 시작`);

    try {
        const res = await fetch(`${API_BASE}/api/ezadmin/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
        });
        const data = await res.json();
        console.log(`[스케줄러] ${type} 수집 완료:`, data.message || data.error || '응답 없음');
        return data;
    } catch (error) {
        console.error(`[스케줄러] ${type} 수집 실패:`, error);
        return null;
    }
}

let scheduled = false;

export function startEzadminScheduler() {
    // 중복 등록 방지
    if (scheduled) return;
    scheduled = true;

    console.log('[스케줄러] 이지어드민 자동 수집 등록됨 — 매일 오전 9시 30분');

    // 매일 오전 9시 30분 (한국 시간)
    cron.schedule('30 9 * * *', async () => {
        console.log('[스케줄러] ⏰ 오전 9:30 자동 주문 수집 시작');
        await callScrapeAPI('orders');  // 주문 수집
        await callScrapeAPI('stock');   // 재고 수집
        console.log('[스케줄러] ✅ 오전 9:30 수집 완료');
    }, { timezone: 'Asia/Seoul' });
}
