// src/app/api/musinsa/orders/route.ts
// 무신사 주문 수집 API
// 결제완료/주문확인 상태 주문을 수집하고, SKU 매핑을 적용

import { NextRequest, NextResponse } from 'next/server';
import { MusinsaAdapter, MusinsaApiError } from '@/channels/musinsa.adapter';
import { applyMappingToItems } from '@/services/sku-mapping.service';
import { promises as fs } from 'fs';
import path from 'path';

// 수집된 주문 저장 경로
const ORDERS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-orders.json');

// 중복 수집 방지 락 (대행사 단일 지정 — 동시 수집 차단)
let isCollecting = false;

// GET: 수집된 주문 목록 조회
export async function GET() {
    try {
        const raw = await fs.readFile(ORDERS_FILE, 'utf-8');
        const orders = JSON.parse(raw);
        return NextResponse.json({ success: true, data: orders });
    } catch {
        return NextResponse.json({ success: true, data: [] });
    }
}

// POST: 무신사에서 새 주문 수집 실행
export async function POST(req: NextRequest) {
    // ─── 중복 수집 방지 (세션 관리) ───
    if (isCollecting) {
        return NextResponse.json(
            { error: '이미 주문 수집이 진행 중입니다. 완료될 때까지 기다려 주세요.' },
            { status: 409 }
        );
    }

    isCollecting = true;

    try {
        const body = await req.json().catch(() => ({}));
        const sinceDate = body.since
            ? new Date(body.since)
            : new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 기본 15일

        // 무신사 어댑터 생성
        const adapter = new MusinsaAdapter({
            apiKey: process.env.MUSINSA_API_KEY || '',
            baseUrl: process.env.MUSINSA_API_BASE_URL || '',
        });

        // 주문 수집 실행
        const rawOrders = await adapter.fetchOrders(sinceDate);

        // SKU 매핑 적용 — 미매핑 상품 자동 분류
        let totalUnmapped = 0;
        const ordersWithMapping = await Promise.all(
            rawOrders.map(async (order) => {
                const { mappedItems, unmappedCount } = await applyMappingToItems(order.items);
                totalUnmapped += unmappedCount;
                return {
                    ...order,
                    items: mappedItems,
                    hasUnmappedItems: unmappedCount > 0, // 미매핑 플래그
                    collectedAt: new Date().toISOString(),
                };
            })
        );

        // 기존 주문과 병합 (중복 방지)
        let existingOrders: Record<string, unknown>[] = [];
        try {
            const raw = await fs.readFile(ORDERS_FILE, 'utf-8');
            existingOrders = JSON.parse(raw);
        } catch { /* 첫 수집 */ }

        const existingIds = new Set(existingOrders.map((o: Record<string, unknown>) => o.externalOrderId));
        const newOrders = ordersWithMapping.filter(o => !existingIds.has(o.externalOrderId));
        const allOrders = [...newOrders, ...existingOrders];

        // 저장
        const dir = path.dirname(ORDERS_FILE);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(ORDERS_FILE, JSON.stringify(allOrders, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `주문 수집 완료! 신규 ${newOrders.length}건, 총 ${allOrders.length}건`,
            stats: {
                collected: rawOrders.length,
                newOrders: newOrders.length,
                totalOrders: allOrders.length,
                unmappedItems: totalUnmapped,
            },
        });
    } catch (error) {
        // ─── 에러 코드별 세분화된 응답 ───
        if (error instanceof MusinsaApiError) {
            return NextResponse.json(
                { error: error.message, code: error.statusCode },
                { status: error.statusCode || 500 }
            );
        }

        const message = error instanceof Error ? error.message : '주문 수집에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    } finally {
        isCollecting = false; // 락 해제
    }
}
