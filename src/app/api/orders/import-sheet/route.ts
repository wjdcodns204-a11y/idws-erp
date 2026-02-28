// src/app/api/orders/import-sheet/route.ts
// 구글 시트에서 판매 데이터(CSV)를 가져와 주문 형식으로 변환하는 API
// 비유: 구글 시트가 "원본 장부"고, 이 API가 장부 내용을 읽어서 ERP가 이해할 수 있는 형태로 바꿔주는 통역사 역할

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ─── 구글 시트 설정 ───
const SHEET_ID = '1ZUZbBGDhZlTcCh-6VtpX3Y29uk5iI2aVyCv08zuqCXw';
const GID = '1857956875';

// ─── 데이터 저장 경로 ───
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');

// ─── CSV 한 줄을 올바르게 파싱하는 함수 ───
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseAmount(val: string): number {
    if (!val) return 0;
    return parseInt(val.replace(/,/g, '').replace(/"/g, '')) || 0;
}

function extractChannel(seller: string): string {
    if (!seller) return '기타';
    const match = seller.match(/\)(.+)$/);
    if (match) return match[1].trim();
    return seller.trim();
}

function formatName(name: string): string {
    return name || '―';
}

function maskPhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/(\d{3})-(\d{3,4})-(\d{4})/, '$1-****-$3');
}

interface SheetOrderItem {
    name: string;
    code: string;
    barcode: string;
    size: string;
    qty: number;
    price: number;
    costPrice: number;
    margin: number;
    discountRate: string;
}

interface SheetOrder {
    id: string;
    date: string;
    time: string;
    channel: string;
    customer: string;
    phone: string;
    address: string;
    items: SheetOrderItem[];
    totalAmount: number;
    shippingFee: number;
    status: string;
    weekLabel: string;
}

export async function GET() {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
        const response = await fetch(csvUrl, {
            headers: { 'User-Agent': 'IDWS-ERP/1.0' },
        });

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: `구글 시트 접근 실패 (${response.status}). 시트가 '링크가 있는 사용자에게 뷰어 권한'으로 공유되어 있는지 확인해 주세요.` },
                { status: 502 }
            );
        }

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            return NextResponse.json(
                { success: false, error: '구글 시트에 데이터가 없습니다' },
                { status: 400 }
            );
        }

        const headers = parseCSVLine(lines[0]);
        const colIdx: Record<string, number> = {};
        headers.forEach((h, i) => { colIdx[h.replace(/\r/g, '')] = i; });

        const orderMap = new Map<string, SheetOrder>();

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < 10) continue;

            const orderNumber = values[colIdx['주문번호']] || `UNKNOWN-${i}`;
            const orderDate = values[colIdx['주문일']] || '';
            const orderTime = values[colIdx['주문시간']] || '';
            const barcode = values[colIdx['바코드']] || '';
            const productCode = values[colIdx['공급처 상품명']] || values[colIdx['품번']] || '';
            const seller = values[colIdx['판매처']] || '';
            const customerName = values[colIdx['수령자이름']] || '';
            const customerPhone = values[colIdx['수령자휴대폰']] || values[colIdx['수령자전화']] || '';
            const customerAddress = values[colIdx['수령자주소']] || '';
            const productName = values[colIdx['상품명']] || values[colIdx['제품명']] || '';
            const optionName = values[colIdx['옵션명']] || '';
            const qty = parseInt(values[colIdx['주문수량']] || '1') || 1;
            const sellingPrice = parseAmount(values[colIdx['실 결제금액']] || values[colIdx['판매가']] || '0');
            const costPrice = parseAmount(values[colIdx['제품 원가']] || values[colIdx['원가']] || '0');
            const marginVal = parseAmount(values[colIdx['마진']] || '0');
            const discountRate = values[colIdx['할인율']] || '';
            const weekLabel = values[colIdx['판매 주차']] || '';

            let size = optionName.replace(/[\[\]]/g, '');
            if (size === '0') size = 'S';
            else if (size === '1') size = 'M';
            else if (size === '2') size = 'L';
            else if (size === '3') size = 'XL';
            else if (size === '4') size = 'XXL';
            else if (size === 'OS') size = 'FREE';

            const item: SheetOrderItem = {
                name: productName, code: productCode, barcode, size, qty,
                price: sellingPrice, costPrice, margin: marginVal, discountRate,
            };

            if (orderMap.has(orderNumber)) {
                const existing = orderMap.get(orderNumber)!;
                existing.items.push(item);
                existing.totalAmount += sellingPrice * qty;
            } else {
                orderMap.set(orderNumber, {
                    id: orderNumber, date: orderDate, time: orderTime,
                    channel: extractChannel(seller),
                    customer: formatName(customerName),
                    phone: maskPhone(customerPhone),
                    address: customerAddress,
                    items: [item],
                    totalAmount: sellingPrice * qty,
                    shippingFee: 0,
                    status: 'PURCHASE_CONFIRMED',
                    weekLabel,
                });
            }
        }

        const orders = Array.from(orderMap.values()).sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.time.localeCompare(a.time);
        });

        // ─── 서버 파일에 자동 저장 (사이트를 껐다 켜도 유지) ───
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            const saveData = {
                orders,
                totalOrders: orders.length,
                totalRows: lines.length - 1,
                savedAt: new Date().toISOString(),
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(saveData), 'utf-8');
            console.log(`[주문 저장] ${orders.length}건 → ${DATA_FILE}`);
        } catch (saveErr) {
            console.error('[주문 파일 저장 실패]', saveErr);
        }

        return NextResponse.json({
            success: true,
            totalRows: lines.length - 1,
            totalOrders: orders.length,
            orders,
        });

    } catch (err) {
        console.error('[구글 시트 Import 오류]', err);
        return NextResponse.json(
            { success: false, error: `구글 시트 데이터 처리 중 오류: ${err instanceof Error ? err.message : String(err)}` },
            { status: 500 }
        );
    }
}

