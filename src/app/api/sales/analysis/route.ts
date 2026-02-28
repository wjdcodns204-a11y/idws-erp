// src/app/api/sales/analysis/route.ts
// 저장된 주문 데이터(data/orders.json) 기반 플랫폼별 매출 분석 API
// 일간/주간/월간/연간 집계

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 저장된 주문 데이터 파일 경로 (주문 관리 페이지에서 저장한 데이터)
const DATA_FILE = path.join(process.cwd(), 'data', 'orders.json');

// ─── 타입 정의 ───
interface OrderItem {
    name: string;
    code: string;
    size: string;
    qty: number;
    price: number;      // 판매가(결제금액)
    costPrice: number;   // 원가
    margin: number;      // 마진(이익)
    discountRate: string;
}

interface SavedOrder {
    id: string;
    date: string;        // YYYY-MM-DD
    time: string;
    channel: string;     // 무신사, 29CM, 카페24 등
    customer: string;
    items: OrderItem[];
    totalAmount: number; // 총 결제금액
    shippingFee: number;
    status: string;
    weekLabel: string;
}

// ─── 주간 키 계산 (ISO Week) ───
function getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ─── 캐시 (20MB JSON을 매번 파싱하면 느림) ───
let cache: { orders: SavedOrder[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

function loadOrders(): SavedOrder[] {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) return cache.orders;

    if (!fs.existsSync(DATA_FILE)) {
        console.log('[매출분석] orders.json 파일 없음');
        return [];
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const orders: SavedOrder[] = data.orders || [];

    console.log(`[매출분석] ${orders.length}건 주문 로드 완료`);
    if (orders.length > 0) {
        const channels = [...new Set(orders.map(o => o.channel))];
        console.log(`[매출분석] 채널: ${channels.join(', ')}`);
    }

    cache = { orders, timestamp: Date.now() };
    return orders;
}

// ─── 집계 결과 타입 ───
interface SalesAggregation {
    period: string;
    platform: string;
    orderCount: number;
    quantity: number;
    totalSales: number;    // 결제금액 합
    totalCost: number;     // 원가 합
    totalProfit: number;   // 이익 합 (margin)
}

function aggregate(
    orders: SavedOrder[],
    groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly'
): SalesAggregation[] {
    const map = new Map<string, SalesAggregation>();

    for (const order of orders) {
        const d = new Date(order.date);
        if (isNaN(d.getTime())) continue;

        // 기간 키 결정
        let period: string;
        switch (groupBy) {
            case 'daily': period = order.date; break;
            case 'weekly': period = getWeekKey(d); break;
            case 'monthly': period = order.date.substring(0, 7); break;
            case 'yearly': period = order.date.substring(0, 4); break;
        }

        const platform = order.channel || '기타';
        const key = `${period}|${platform}`;

        // 이 주문의 총 수량, 원가, 마진 계산
        let totalQty = 0;
        let totalCost = 0;
        let totalMargin = 0;
        for (const item of order.items) {
            totalQty += item.qty;
            totalCost += item.costPrice * item.qty;
            totalMargin += item.margin * item.qty;
        }

        const existing = map.get(key);
        if (existing) {
            existing.orderCount++;
            existing.quantity += totalQty;
            existing.totalSales += order.totalAmount;
            existing.totalCost += totalCost;
            existing.totalProfit += totalMargin;
        } else {
            map.set(key, {
                period, platform,
                orderCount: 1,
                quantity: totalQty,
                totalSales: order.totalAmount,
                totalCost: totalCost,
                totalProfit: totalMargin,
            });
        }
    }

    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}

// ─── GET 핸들러 ───
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const groupBy = (searchParams.get('groupBy') || 'monthly') as
            'daily' | 'weekly' | 'monthly' | 'yearly';

        const orders = loadOrders();
        const aggregated = aggregate(orders, groupBy);

        // 플랫폼 목록 (주문수 많은 순)
        const platformCounts = new Map<string, number>();
        for (const order of orders) {
            const ch = order.channel || '기타';
            platformCounts.set(ch, (platformCounts.get(ch) || 0) + 1);
        }
        const platforms = [...platformCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);

        // 전체 요약 계산
        let totalSales = 0;
        let totalCost = 0;
        let totalProfit = 0;
        for (const order of orders) {
            totalSales += order.totalAmount;
            for (const item of order.items) {
                totalCost += item.costPrice * item.qty;
                totalProfit += item.margin * item.qty;
            }
        }

        return NextResponse.json({
            success: true,
            groupBy,
            platforms,
            summary: {
                totalSales,
                totalCost,
                totalProfit,
                totalOrders: orders.length,
            },
            data: aggregated,
        });
    } catch (error) {
        console.error('[매출분석 오류]', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '매출 분석 실패',
        }, { status: 500 });
    }
}
