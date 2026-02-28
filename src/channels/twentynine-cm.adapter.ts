// src/channels/twentynine-cm.adapter.ts
// 29CM 채널 어댑터 (Partner-Key 인증)

import type { IChannelAdapter, RawOrder, SalesData } from './types';

export class TwentyNineCMAdapter implements IChannelAdapter {
    readonly channelName = '29CM';
    private partnerKey: string;
    private baseUrl = 'https://api.29cm.co.kr'; // 실제 엔드포인트로 교체 필요

    constructor(config: Record<string, string>) {
        this.partnerKey = config.partnerKey;
        if (!this.partnerKey) {
            throw new Error('[29CM 어댑터] partnerKey가 설정되지 않았습니다.');
        }
    }

    async authenticate(): Promise<void> {
        // Partner-Key 헤더 인증 — 별도 토큰 발급 불필요
        console.log(`[29CM] Partner-Key 인증 확인 완료`);
    }

    async fetchOrders(since: Date): Promise<RawOrder[]> {
        // TODO: 29CM 실제 API 호출 구현
        console.log(`[29CM] ${since.toISOString()} 이후 주문 수집 요청`);
        return [];
    }

    async fetchSalesReport(from: Date, to: Date): Promise<SalesData> {
        // TODO: 29CM 실제 정산 API 호출 구현
        console.log(`[29CM] ${from.toISOString()} ~ ${to.toISOString()} 매출 리포트 요청`);
        return {
            channelName: this.channelName,
            periodStart: from,
            periodEnd: to,
            totalSales: 0,
            totalCommission: 0,
            netAmount: 0,
            orderCount: 0,
        };
    }

    async handleWebhook(payload: unknown): Promise<void> {
        // TODO: 29CM Webhook 페이로드 파싱 및 처리
        console.log('[29CM] Webhook 수신:', payload);
    }
}
