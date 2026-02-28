// src/app/api/musinsa/settlements/route.ts
// 무신사 매출 요약 — data/orders.json에서 무신사 채널 주문을 필터링하여 매출 계산
// (무신사 파트너 API 정산 엔드포인트가 비공개이므로 로컬 주문 데이터 활용)

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'orders.json');

// 주문 데이터 타입
interface OrderItem {
    price: number;
    costPrice: number;
    margin: number;
    qty: number;
}

interface SavedOrder {
    date: string;
    channel: string;
    items: OrderItem[];
    totalAmount: number;
    status: string;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // 기간 파라미터 (기본: 이번 달 1일 ~ 오늘)
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        const fromStr = searchParams.get('from') || monthStart;
        const toStr = searchParams.get('to') || now.toISOString().split('T')[0];

        // 주문 데이터 로드
        if (!fs.existsSync(DATA_FILE)) {
            return NextResponse.json({
                success: true,
                data: {
                    channelName: '무신사', periodStart: fromStr, periodEnd: toStr,
                    totalSales: 0, totalCost: 0, totalProfit: 0, orderCount: 0
                },
            });
        }

        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        const allOrders: SavedOrder[] = data.orders || [];

        // 무신사 채널 주문만 필터 (무신사, 무신사글로벌 포함)
        const musinsaOrders = allOrders.filter(order => {
            const ch = (order.channel || '').toLowerCase();
            const isMusinsaChannel = ch.includes('무신사') || ch.includes('musinsa');
            const inRange = order.date >= fromStr && order.date <= toStr;
            return isMusinsaChannel && inRange;
        });

        // 매출 집계
        let totalSales = 0;
        let totalCost = 0;
        let totalProfit = 0;

        for (const order of musinsaOrders) {
            totalSales += order.totalAmount;
            for (const item of order.items) {
                totalCost += item.costPrice * item.qty;
                totalProfit += item.margin * item.qty;
            }
        }

        // 채널별 세분화 (무신사 vs 무신사글로벌)
        const channelBreakdown: Record<string, { sales: number; cost: number; profit: number; orders: number }> = {};
        for (const order of musinsaOrders) {
            const ch = order.channel || '무신사';
            if (!channelBreakdown[ch]) {
                channelBreakdown[ch] = { sales: 0, cost: 0, profit: 0, orders: 0 };
            }
            channelBreakdown[ch].sales += order.totalAmount;
            channelBreakdown[ch].orders++;
            for (const item of order.items) {
                channelBreakdown[ch].cost += item.costPrice * item.qty;
                channelBreakdown[ch].profit += item.margin * item.qty;
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                channelName: '무신사',
                periodStart: fromStr,
                periodEnd: toStr,
                totalSales,
                totalCost,
                totalProfit,
                orderCount: musinsaOrders.length,
                channelBreakdown,  // 무신사/무신사글로벌 세분화
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '무신사 매출 조회 실패';
        console.error('[무신사 매출 오류]', error);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
