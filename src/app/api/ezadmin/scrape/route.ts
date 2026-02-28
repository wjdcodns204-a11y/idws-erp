// src/app/api/ezadmin/scrape/route.ts
// 이지어드민 스크래핑 API — 재고/주문 데이터 자동 수집

import { NextRequest, NextResponse } from 'next/server';
import { scrapeStock, scrapeOrders, exploreEzadmin, closeBrowser } from '@/services/ezadmin-scraper';
import { promises as fs } from 'fs';
import path from 'path';

const PRODUCTS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-products.json');

// POST: 스크래핑 실행 (type 파라미터로 분기)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const type = (body.type as string) || 'explore';

        switch (type) {
            // ─── 사이트 탐색 (디버깅용) ───
            case 'explore': {
                const result = await exploreEzadmin();
                return NextResponse.json(result);
            }

            // ─── 재고 스크래핑 ───
            case 'stock': {
                const result = await scrapeStock();

                if (result.success && result.data.length > 0) {
                    // 기존 상품 데이터에 재고 반영
                    try {
                        const raw = await fs.readFile(PRODUCTS_FILE, 'utf-8');
                        const products = JSON.parse(raw) as Array<Record<string, unknown>>;

                        // 품번별 사이즈 재고 그룹핑
                        interface SizeStock { size: string; stock: number; defective: number; available: number; }
                        const stockMap = new Map<string, { total: number; totalAvailable: number; sizes: SizeStock[] }>();

                        for (const item of result.data) {
                            if (!item.styleCode) continue;
                            if (!stockMap.has(item.styleCode)) {
                                stockMap.set(item.styleCode, { total: 0, totalAvailable: 0, sizes: [] });
                            }
                            const entry = stockMap.get(item.styleCode)!;
                            entry.total += item.normalStock;
                            entry.totalAvailable += item.availableStock;
                            entry.sizes.push({
                                size: item.option.replace(/[\[\]]/g, '') || 'OS',
                                stock: item.normalStock,
                                defective: item.defectiveStock,
                                available: item.availableStock,
                            });
                        }

                        let matched = 0;
                        for (const product of products) {
                            const data = stockMap.get(product.styleCode as string);
                            if (data) {
                                product.stock = data.total;
                                product.availableStock = data.totalAvailable;
                                product.sizeStock = data.sizes;
                                matched++;
                            }
                        }

                        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');

                        return NextResponse.json({
                            success: true,
                            message: `이지어드민 재고 ${result.data.length}건 수집, ${matched}개 상품 반영`,
                            stats: { scraped: result.data.length, matched, total: products.length },
                        });
                    } catch {
                        return NextResponse.json({
                            success: true,
                            message: `재고 ${result.data.length}건 수집 (상품 파일 업데이트 실패)`,
                            data: result.data.slice(0, 10), // 샘플만
                        });
                    }
                }
                return NextResponse.json(result);
            }

            // ─── 주문 스크래핑 ───
            case 'orders': {
                const result = await scrapeOrders();

                if (result.success && result.data.length > 0) {
                    // 1) 이지어드민 자체 저장 (기존 방식 유지)
                    const EZADMIN_ORDERS_FILE = path.join(process.cwd(), 'public', 'data', 'ezadmin-orders.json');
                    try {
                        let existing: Record<string, unknown>[] = [];
                        try {
                            const raw = await fs.readFile(EZADMIN_ORDERS_FILE, 'utf-8');
                            existing = JSON.parse(raw);
                        } catch { /* 첫 실행 */ }

                        const orderMap = new Map<string, Record<string, unknown>>();
                        for (const o of existing) {
                            const key = String(o['주문번호'] || o['col0'] || JSON.stringify(o));
                            orderMap.set(key, o);
                        }
                        for (const o of result.data) {
                            const key = String(o['주문번호'] || o['col0'] || JSON.stringify(o));
                            orderMap.set(key, o);
                        }
                        const merged = Array.from(orderMap.values());
                        await fs.writeFile(EZADMIN_ORDERS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
                    } catch { /* ezadmin 파일 저장 실패 무시 */ }

                    // 2) 주문 관리 페이지용 data/orders.json에도 병합 (중복 제거)
                    const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');
                    let totalOrders = 0;
                    let duplicatesRemoved = 0;
                    try {
                        // 기존 저장된 주문 불러오기
                        interface SavedOrder { id: string;[key: string]: unknown; }
                        let savedOrders: SavedOrder[] = [];
                        try {
                            const raw = await fs.readFile(ORDERS_FILE, 'utf-8');
                            const parsed = JSON.parse(raw);
                            savedOrders = parsed.orders || [];
                        } catch { /* 첫 실행 */ }

                        const beforeCount = savedOrders.length;

                        // 수집된 데이터를 주문 형식으로 변환
                        for (const o of result.data) {
                            const orderId = String(o['주문번호'] || o['col0'] || '');
                            // 주문번호가 없거나, 숫자로 시작하지 않으면 건너뜀
                            // (헤더 행이나 메타데이터 행 필터링: "상품명", "클센추가항목5" 등 제거)
                            if (!orderId || !/^\d/.test(orderId)) continue;

                            // 기존에 동일 주문번호가 있으면 제거 (최신으로 교체)
                            savedOrders = savedOrders.filter(s => s.id !== orderId);

                            // 새 주문 추가
                            savedOrders.unshift({
                                id: orderId,
                                date: String(o['주문일'] || o['col1'] || new Date().toISOString().slice(0, 10)),
                                time: String(o['주문시간'] || o['col2'] || ''),
                                channel: String(o['판매처'] || o['col3'] || '이지어드민'),
                                customer: String(o['수령자이름'] || o['col4'] || '―'),
                                phone: String(o['수령자휴대폰'] || o['col5'] || ''),
                                address: String(o['수령자주소'] || o['col6'] || ''),
                                items: [{
                                    name: String(o['상품명'] || o['col7'] || ''),
                                    code: String(o['품번'] || o['col8'] || ''),
                                    barcode: String(o['바코드'] || ''),
                                    size: String(o['옵션명'] || 'FREE'),
                                    qty: Number(o['주문수량'] || o['col9'] || 1),
                                    price: Number(String(o['결제금액'] || o['col10'] || 0).replace(/,/g, '')),
                                    costPrice: 0,
                                    margin: 0,
                                    discountRate: '',
                                }],
                                totalAmount: Number(String(o['결제금액'] || o['col10'] || 0).replace(/,/g, '')),
                                shippingFee: 0,
                                status: 'PURCHASE_CONFIRMED',
                                weekLabel: '',
                            });
                        }

                        // 중복이 제거된 건수 계산
                        duplicatesRemoved = beforeCount + result.data.length - savedOrders.length;
                        totalOrders = savedOrders.length;

                        // 저장
                        const dataDir = path.join(process.cwd(), 'data');
                        try { await fs.mkdir(dataDir, { recursive: true }); } catch { /* 이미 존재 */ }
                        await fs.writeFile(ORDERS_FILE, JSON.stringify({
                            orders: savedOrders,
                            totalOrders: savedOrders.length,
                            savedAt: new Date().toISOString(),
                        }), 'utf-8');

                        console.log(`[이지어드민] ${result.data.length}건 수집, 중복 ${duplicatesRemoved}건 제거, 총 ${totalOrders}건 저장`);
                    } catch (mergeErr) {
                        console.error('[주문 병합 저장 실패]', mergeErr);
                    }

                    return NextResponse.json({
                        success: true,
                        message: `주문 ${result.data.length}건 수집, 중복 ${duplicatesRemoved}건 제거, 총 ${totalOrders}건 저장`,
                        stats: {
                            newOrders: result.data.length,
                            duplicatesRemoved,
                            totalOrders,
                            collectedAt: new Date().toISOString(),
                        },
                    });
                }
                return NextResponse.json({
                    ...result,
                    message: result.data.length === 0
                        ? `주문 데이터 0건 (페이지: ${result.currentUrl || '알 수 없음'})`
                        : `주문 ${result.data.length}건 수집`,
                });
            }

            // ─── 브라우저 종료 ───
            case 'close': {
                await closeBrowser();
                return NextResponse.json({ success: true, message: '브라우저 종료됨' });
            }

            default:
                return NextResponse.json({ error: 'type 파라미터 필요 (explore|stock|orders|close)' }, { status: 400 });
        }
    } catch (error) {
        console.error('[스크래핑 API 오류]', error);
        const message = error instanceof Error ? error.message : '스크래핑 실패';

        // 자동화 실패 기록 (비동기로 처리 — 실패해도 응답에 영향 없음)
        try {
            const body = await new Response(request.body).json().catch(() => ({}));
            const jobLabel = body?.type === 'stock' ? '이지어드민 재고'
                : body?.type === 'orders' ? '이지어드민 주문'
                    : '이지어드민';
            await fetch(new URL('/api/automation/log', request.url).toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_name: jobLabel, status: 'failure', error_message: message }),
            });
        } catch { /* 로그 기록 실패 무시 */ }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
