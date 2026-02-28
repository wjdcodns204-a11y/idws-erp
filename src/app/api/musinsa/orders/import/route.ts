// src/app/api/musinsa/orders/import/route.ts
// 주문 엑셀 업로드 → JSON 저장 API
// 이지어드민 또는 무신사 파트너센터에서 다운로드한 주문 엑셀을 파싱

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { applyMappingToItems } from '@/services/sku-mapping.service';

const ORDERS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-orders.json');

// ─── 주문 엑셀 헤더 → JSON 필드 매핑 ───
// 이지어드민/무신사 엑셀 버전에 따라 헤더가 다를 수 있으므로 유연하게 매핑
const HEADER_MAP: Record<string, string> = {
    // 주문번호
    '주문번호': 'orderNumber', '주문코드': 'orderNumber', '주문 번호': 'orderNumber',
    'order_no': 'orderNumber', '주문No': 'orderNumber',

    // 주문일시
    '주문일시': 'orderedAt', '주문일': 'orderedAt', '주문날짜': 'orderedAt',
    '결제일시': 'orderedAt', '결제일': 'orderedAt', 'order_date': 'orderedAt',

    // 주문상태
    '주문상태': 'status', '처리상태': 'status', '상태': 'status',
    'order_status': 'status', '진행상태': 'status',

    // 구매자
    '구매자명': 'customerName', '주문자명': 'customerName', '구매자': 'customerName',
    '주문자': 'customerName', 'buyer_name': 'customerName',
    '구매자연락처': 'customerPhone', '구매자 연락처': 'customerPhone',
    '주문자연락처': 'customerPhone', '주문자 휴대폰': 'customerPhone',

    // 수취인
    '수취인명': 'receiverName', '수취인': 'receiverName', '받는분': 'receiverName',
    '수취인연락처': 'receiverPhone', '수취인 연락처': 'receiverPhone',
    '수취인주소': 'customerAddress', '배송지 주소': 'customerAddress',
    '배송지주소': 'customerAddress', '주소': 'customerAddress',
    '우편번호': 'customerZipcode', '수취인 우편번호': 'customerZipcode',

    // 상품 정보
    '상품명': 'productName', '제품명': 'productName', '상품 명': 'productName',
    'product_name': 'productName',
    '옵션': 'optionInfo', '옵션정보': 'optionInfo', '선택옵션': 'optionInfo',
    '옵션 정보': 'optionInfo',
    '수량': 'quantity', '주문수량': 'quantity', '판매수량': 'quantity',
    'quantity': 'quantity',

    // 상품코드
    '상품코드': 'productCode', '품번': 'productCode', '자체상품코드': 'productCode',
    '업체상품코드': 'productCode', '품번코드': 'productCode',
    '단품코드': 'optionCode', '옵션코드': 'optionCode',
    '무신사 상품번호': 'musinsaGoodsNo', '상품번호': 'musinsaGoodsNo',

    // 금액
    '판매가': 'unitPrice', '판매단가': 'unitPrice', '상품가격': 'unitPrice',
    '상품금액': 'unitPrice', 'price': 'unitPrice',
    '할인금액': 'discountAmount', '할인액': 'discountAmount',
    '결제금액': 'totalAmount', '실결제금액': 'totalAmount', '총 결제금액': 'totalAmount',
    '주문금액': 'totalAmount',
    '배송비': 'shippingFee', '배송료': 'shippingFee',

    // 배송
    '택배사': 'courier', '배송업체': 'courier',
    '운송장번호': 'trackingNumber', '송장번호': 'trackingNumber', '운송장': 'trackingNumber',

    // 판매채널
    '판매처': 'channel', '판매채널': 'channel', '쇼핑몰': 'channel',
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { rows } = body;

        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: '엑셀 데이터가 비어있습니다.' }, { status: 400 });
        }

        // ─── 헤더 매핑 분석 ───
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        const fieldMap: Record<string, string> = {};
        const unmappedHeaders: string[] = [];

        for (const key of keys) {
            const trimmed = key.trim();
            if (HEADER_MAP[trimmed]) {
                fieldMap[key] = HEADER_MAP[trimmed];
            } else {
                unmappedHeaders.push(trimmed);
            }
        }

        // 필수 필드 확인 (주문번호 또는 상품명)
        const mappedFields = new Set(Object.values(fieldMap));
        if (!mappedFields.has('orderNumber') && !mappedFields.has('productName')) {
            return NextResponse.json({
                error: '엑셀 헤더를 인식할 수 없습니다. "주문번호" 또는 "상품명" 컬럼이 필요합니다.',
                detectedHeaders: keys,
            }, { status: 400 });
        }

        // ─── 행 데이터 → 주문 변환 ───
        // 같은 주문번호의 여러 행은 하나의 주문으로 묶음 (여러 상품)
        const orderMap = new Map<string, Record<string, unknown>>();

        const toNum = (v: unknown): number => {
            if (typeof v === 'number') return v;
            if (typeof v === 'string') return Number(v.replace(/[,원₩\s]/g, '')) || 0;
            return 0;
        };

        for (const row of rows) {
            const mapped: Record<string, unknown> = {};
            for (const [excelKey, jsonField] of Object.entries(fieldMap)) {
                mapped[jsonField] = row[excelKey];
            }

            const orderNum = String(mapped.orderNumber || `AUTO-${Date.now()}-${Math.random().toString(36).substring(7)}`);

            // 상품 아이템 생성
            const item = {
                externalProductId: String(mapped.productCode || mapped.musinsaGoodsNo || ''),
                externalSkuId: String(mapped.optionCode || ''),
                productName: String(mapped.productName || ''),
                optionInfo: String(mapped.optionInfo || ''),
                sizeOption: String(mapped.optionInfo || ''),
                quantity: toNum(mapped.quantity) || 1,
                unitPrice: toNum(mapped.unitPrice),
                discountAmount: toNum(mapped.discountAmount),
            };

            if (orderMap.has(orderNum)) {
                // 기존 주문에 상품 추가
                const existing = orderMap.get(orderNum)!;
                (existing.items as Record<string, unknown>[]).push(item);
                existing.totalAmount = toNum(existing.totalAmount) + item.unitPrice * item.quantity;
            } else {
                // 신규 주문 생성
                orderMap.set(orderNum, {
                    externalOrderId: orderNum,
                    orderNumber: orderNum,
                    customerName: String(mapped.customerName || mapped.receiverName || ''),
                    customerPhone: String(mapped.customerPhone || mapped.receiverPhone || ''),
                    customerAddress: String(mapped.customerAddress || ''),
                    customerZipcode: String(mapped.customerZipcode || ''),
                    totalAmount: toNum(mapped.totalAmount) || item.unitPrice * item.quantity,
                    totalDiscount: toNum(mapped.discountAmount),
                    shippingFee: toNum(mapped.shippingFee),
                    orderedAt: String(mapped.orderedAt || new Date().toISOString()),
                    status: String(mapped.status || '결제완료'),
                    channel: String(mapped.channel || '무신사'),
                    courier: String(mapped.courier || ''),
                    trackingNumber: String(mapped.trackingNumber || ''),
                    items: [item],
                    importedAt: new Date().toISOString(),
                    source: 'excel',
                });
            }
        }

        // ─── SKU 매핑 적용 ───
        let totalUnmapped = 0;
        const ordersArray = [];

        for (const order of orderMap.values()) {
            const items = order.items as Array<{ externalProductId?: string; externalSkuId?: string; productName: string; optionInfo?: string; sizeOption: string; quantity: number; unitPrice: number; discountAmount: number }>;
            const { mappedItems, unmappedCount } = await applyMappingToItems(items);
            totalUnmapped += unmappedCount;
            ordersArray.push({
                ...order,
                items: mappedItems,
                hasUnmappedItems: unmappedCount > 0,
            });
        }

        // ─── 기존 주문과 병합 ───
        let existingOrders: Record<string, unknown>[] = [];
        try {
            const raw = await fs.readFile(ORDERS_FILE, 'utf-8');
            existingOrders = JSON.parse(raw);
        } catch { /* 첫 등록 */ }

        const existingIds = new Set(existingOrders.map(o => o.externalOrderId));
        const newOrders = ordersArray.filter(o => !existingIds.has(o.externalOrderId));
        const updatedOrders = ordersArray.filter(o => existingIds.has(o.externalOrderId));

        // 업데이트된 주문은 기존 것 대체
        const finalOrders = [
            ...newOrders,
            ...existingOrders.map(existing => {
                const updated = updatedOrders.find(u => u.externalOrderId === existing.externalOrderId);
                return updated || existing;
            }),
        ];

        // 저장
        const dir = path.dirname(ORDERS_FILE);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(ORDERS_FILE, JSON.stringify(finalOrders, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `주문 업로드 완료! 신규 ${newOrders.length}건, 업데이트 ${updatedOrders.length}건, 총 ${finalOrders.length}건`,
            stats: {
                totalRows: rows.length,
                totalOrders: ordersArray.length,
                newOrders: newOrders.length,
                updatedOrders: updatedOrders.length,
                totalSaved: finalOrders.length,
                unmappedItems: totalUnmapped,
            },
            unmappedHeaders: unmappedHeaders.length > 0 ? unmappedHeaders : undefined,
        });
    } catch (error) {
        console.error('[주문 엑셀 업로드 오류]', error);
        const message = error instanceof Error ? error.message : '업로드에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
