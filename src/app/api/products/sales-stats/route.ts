// src/app/api/products/sales-stats/route.ts
// 주문 데이터에서 상품별 주간 판매 통계를 계산하는 API
// data/orders.json의 주문 데이터를 상품명 기준으로 집계합니다

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

// ─── 상품별 판매 통계를 계산하여 반환 ───
export async function GET() {
    try {
        const raw = await fs.readFile(ORDERS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        const orders = data.orders || [];

        // 상품명별 판매 데이터 집계
        interface SalesEntry {
            totalQty: number;
            totalAmount: number;
            orderCount: number;
            firstDate: string;
            lastDate: string;
        }
        const salesMap = new Map<string, SalesEntry>();

        for (const order of orders) {
            const orderDate = String(order.date || '');
            if (!order.items || !Array.isArray(order.items)) continue;

            for (const item of order.items) {
                const name = String(item.name || '').trim();
                if (!name) continue;
                const qty = Number(item.qty || 1);

                const existing = salesMap.get(name);
                if (existing) {
                    existing.totalQty += qty;
                    existing.totalAmount += Number(item.price || 0) * qty;
                    existing.orderCount += 1;
                    if (orderDate < existing.firstDate) existing.firstDate = orderDate;
                    if (orderDate > existing.lastDate) existing.lastDate = orderDate;
                } else {
                    salesMap.set(name, {
                        totalQty: qty,
                        totalAmount: Number(item.price || 0) * qty,
                        orderCount: 1,
                        firstDate: orderDate,
                        lastDate: orderDate,
                    });
                }
            }
        }

        // 주간 평균 계산
        const now = new Date();
        const stats: Record<string, {
            totalQty: number;
            weeklyAvg: number;
            orderCount: number;
            totalAmount: number;
            firstDate: string;
            lastDate: string;
        }> = {};

        for (const [name, entry] of salesMap.entries()) {
            // 첫 주문부터 현재까지의 주(week) 수 계산
            const first = new Date(entry.firstDate);
            const diffMs = now.getTime() - first.getTime();
            const weeks = Math.max(1, diffMs / (7 * 24 * 60 * 60 * 1000));
            const weeklyAvg = Math.round((entry.totalQty / weeks) * 10) / 10;

            stats[name] = {
                totalQty: entry.totalQty,
                weeklyAvg,
                orderCount: entry.orderCount,
                totalAmount: entry.totalAmount,
                firstDate: entry.firstDate,
                lastDate: entry.lastDate,
            };
        }

        return NextResponse.json({
            success: true,
            totalProducts: Object.keys(stats).length,
            totalOrders: orders.length,
            stats,
        });
    } catch {
        return NextResponse.json({
            success: true,
            totalProducts: 0,
            totalOrders: 0,
            stats: {},
        });
    }
}
