// src/channels/cafe24.adapter.ts
// LLUD (카페24 기반) 채널 어댑터 (OAuth 2.0 인증)

import type { IChannelAdapter, RawOrder, SalesData } from './types';

export class Cafe24Adapter implements IChannelAdapter {
    readonly channelName = 'LLUD (카페24)';
    private mallId: string;
    private clientId: string;
    private clientSecret: string;
    private refreshToken: string;
    private accessToken = '';
    private tokenExpiresAt = new Date(0);

    constructor(config: Record<string, string>) {
        this.mallId = config.mallId;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.refreshToken = config.refreshToken;

        if (!this.mallId || !this.clientId || !this.clientSecret) {
            throw new Error('[카페24 어댑터] mallId, clientId, clientSecret이 필요합니다.');
        }
    }

    /**
     * OAuth 2.0 토큰 발급/갱신
     * Access Token이 만료되었을 때만 갱신합니다.
     */
    async authenticate(): Promise<void> {
        // 아직 유효하면 스킵
        if (this.tokenExpiresAt > new Date()) {
            return;
        }

        const res = await fetch(
            `https://${this.mallId}.cafe24api.com/api/v2/oauth/token`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
                },
                body: `grant_type=refresh_token&refresh_token=${this.refreshToken}`,
            }
        );

        if (!res.ok) {
            throw new Error(`[카페24 인증 실패] HTTP ${res.status}: ${await res.text()}`);
        }

        const token = await res.json();
        this.accessToken = token.access_token;
        this.tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);

        // 새 Refresh Token이 발급된 경우 업데이트
        if (token.refresh_token) {
            this.refreshToken = token.refresh_token;
            // TODO: DB의 apiConfigEnc도 업데이트해야 함
            console.log('[카페24] 새 Refresh Token 발급됨 — DB 업데이트 필요');
        }

        console.log(`[카페24] 토큰 갱신 완료 (만료: ${this.tokenExpiresAt.toISOString()})`);
    }

    private get authHeaders() {
        return {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        };
    }

    async fetchOrders(since: Date): Promise<RawOrder[]> {
        await this.authenticate();

        // TODO: 카페24 Admin API로 주문 목록 조회
        console.log(`[카페24] ${since.toISOString()} 이후 주문 수집 요청`);
        return [];
    }

    async fetchSalesReport(from: Date, to: Date): Promise<SalesData> {
        await this.authenticate();

        // TODO: 카페24 Dashboard API로 매출 현황 조회
        console.log(`[카페24] ${from.toISOString()} ~ ${to.toISOString()} 매출 리포트 요청`);
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
        // TODO: 카페24 Webhook 페이로드 파싱 및 처리
        console.log('[카페24] Webhook 수신:', payload);
    }
}
