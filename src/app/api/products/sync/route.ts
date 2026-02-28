// src/app/api/products/sync/route.ts
// 무신사 엑셀 업로드 → musinsa-products.json 자동 갱신 API

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// ─── 무신사 엑셀 헤더 → JSON 필드 매핑 ───
// 파트너센터 엑셀 헤더명은 버전에 따라 다를 수 있으므로 유연하게 매핑
const HEADER_MAP: Record<string, string> = {
    // musinsaCode
    '상품번호': 'musinsaCode',
    '무신사 상품번호': 'musinsaCode',
    '상품코드': 'musinsaCode',
    'goods_no': 'musinsaCode',

    // brand
    '브랜드': 'brand',
    'brand': 'brand',

    // categoryL
    '대카테고리': 'categoryL',
    '판매형태': 'categoryL',

    // categoryM
    '중카테고리': 'categoryM',
    '카테고리': 'categoryM',
    'category': 'categoryM',

    // categoryS
    '소카테고리': 'categoryS',

    // styleCode
    '업체상품코드': 'styleCode',
    '품번': 'styleCode',
    '자체 상품코드': 'styleCode',
    'style_code': 'styleCode',

    // imageUrl
    '상품이미지': 'imageUrl',
    '대표이미지': 'imageUrl',
    '이미지URL': 'imageUrl',
    '이미지': 'imageUrl',
    'image_url': 'imageUrl',

    // name
    '상품명': 'name',
    '제품명': 'name',
    'product_name': 'name',

    // status
    '판매상태': 'status',
    '상태': 'status',
    'status': 'status',

    // tagPrice
    '판매가': 'tagPrice',
    '정상가': 'tagPrice',
    '소비자가': 'tagPrice',
    'tag_price': 'tagPrice',

    // sellingPrice
    '할인가': 'sellingPrice',
    '현재판매가': 'sellingPrice',
    '실판매가': 'sellingPrice',
    'selling_price': 'sellingPrice',

    // stock
    '총재고': 'stock',
    '재고수량': 'stock',
    '재고': 'stock',
    'total_stock': 'stock',

    // availableStock
    '판매가능재고': 'availableStock',
    '가용재고': 'availableStock',
    'available_stock': 'availableStock',

    // costPrice
    '공급가': 'costPrice',
    '원가': 'costPrice',
    '공급가액': 'costPrice',
    'cost_price': 'costPrice',

    // commissionRate
    '수수료율': 'commissionRate',
    '수수료': 'commissionRate',
    'commission_rate': 'commissionRate',

    // discountRate
    '할인율': 'discountRate',
    'discount_rate': 'discountRate',

    // store
    '스토어': 'store',
    '매장': 'store',
    '판매처': 'store',
    'store': 'store',

    // registeredAt
    '등록일': 'registeredAt',
    '등록일시': 'registeredAt',
    '상품등록일': 'registeredAt',
    'registered_at': 'registeredAt',

    // origin
    '원산지': 'origin',
    'origin': 'origin',
};

// ─── 무신사 상태 매핑 ───
const STATUS_MAP: Record<string, string> = {
    '판매중': '판매중',
    '판매': '판매중',
    '승인': '판매중',
    '판매대기': '판매중',
    '품절': '품절',
    '일시품절': '품절',
    '판매중지': '판매중지',
    '미사용': '판매중지',
    '검수반려': '검수반려',
    '반려': '검수반려',
    '삭제': '삭제',
};

interface MusinsaProduct {
    musinsaCode: string;
    brand: string;
    categoryL: string;
    categoryM: string;
    categoryS: string;
    styleCode: string;
    imageUrl: string;
    name: string;
    status: string;
    tagPrice: number;
    sellingPrice: number;
    stock: number;
    availableStock: number;
    costPrice: number;
    commissionRate: number;
    discountRate: number;
    store: string;
    registeredAt: string;
    origin: string;
}

// POST /api/products/sync
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { rows } = body;

        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json(
                { error: '엑셀 데이터가 비어있습니다.' },
                { status: 400 },
            );
        }

        // 헤더 매핑 분석
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

        // 최소 필수 필드 확인 (상품명 또는 품번)
        const mappedFields = new Set(Object.values(fieldMap));
        if (!mappedFields.has('name') && !mappedFields.has('styleCode')) {
            return NextResponse.json({
                error: '엑셀 헤더를 인식할 수 없습니다. "상품명" 또는 "품번" 컬럼이 필요합니다.',
                detectedHeaders: keys,
                unmappedHeaders,
            }, { status: 400 });
        }

        // 행 데이터 → MusinsaProduct 변환
        const products: MusinsaProduct[] = [];

        for (const row of rows) {
            const mapped: Record<string, unknown> = {};
            for (const [excelKey, jsonField] of Object.entries(fieldMap)) {
                mapped[jsonField] = row[excelKey];
            }

            // 상품명이 없으면 스킵
            if (!mapped.name && !mapped.styleCode) continue;

            // 숫자 필드 변환
            const toNum = (v: unknown): number => {
                if (typeof v === 'number') return v;
                if (typeof v === 'string') {
                    const cleaned = v.replace(/[,원%\s]/g, '');
                    return Number(cleaned) || 0;
                }
                return 0;
            };

            // 상태 매핑
            const rawStatus = String(mapped.status || '판매중').trim();
            const normalizedStatus = STATUS_MAP[rawStatus] || rawStatus;

            const product: MusinsaProduct = {
                musinsaCode: String(mapped.musinsaCode || ''),
                brand: String(mapped.brand || ''),
                categoryL: String(mapped.categoryL || ''),
                categoryM: String(mapped.categoryM || ''),
                categoryS: String(mapped.categoryS || ''),
                styleCode: String(mapped.styleCode || ''),
                imageUrl: String(mapped.imageUrl || ''),
                name: String(mapped.name || ''),
                status: normalizedStatus,
                tagPrice: toNum(mapped.tagPrice),
                sellingPrice: toNum(mapped.sellingPrice) || toNum(mapped.tagPrice),
                stock: toNum(mapped.stock),
                availableStock: toNum(mapped.availableStock),
                costPrice: toNum(mapped.costPrice),
                commissionRate: toNum(mapped.commissionRate),
                discountRate: toNum(mapped.discountRate),
                store: String(mapped.store || ''),
                registeredAt: String(mapped.registeredAt || ''),
                origin: String(mapped.origin || ''),
            };

            products.push(product);
        }

        if (products.length === 0) {
            return NextResponse.json(
                { error: '유효한 상품 데이터가 없습니다.' },
                { status: 400 },
            );
        }

        // 기존 JSON 파일 읽기
        const jsonPath = path.join(process.cwd(), 'public', 'data', 'musinsa-products.json');
        let existingProducts: MusinsaProduct[] = [];
        try {
            const raw = await fs.readFile(jsonPath, 'utf-8');
            existingProducts = JSON.parse(raw);
        } catch {
            // 파일이 없으면 빈 배열로 시작
            existingProducts = [];
        }

        // musinsaCode 또는 styleCode+name 기준으로 병합 (신규 데이터 우선)
        const mergedMap = new Map<string, MusinsaProduct>();

        // 기존 데이터 먼저 등록
        for (const p of existingProducts) {
            const key = p.musinsaCode || `${p.styleCode}_${p.name}`;
            mergedMap.set(key, p);
        }

        // 신규 데이터로 덮어쓰기 (업데이트 + 추가)
        let newCount = 0;
        let updatedCount = 0;
        for (const p of products) {
            const key = p.musinsaCode || `${p.styleCode}_${p.name}`;
            if (mergedMap.has(key)) {
                // 기존 상품 업데이트 — 이미지가 없으면 기존 것 유지
                const existing = mergedMap.get(key)!;
                if (!p.imageUrl && existing.imageUrl) {
                    p.imageUrl = existing.imageUrl;
                }
                updatedCount++;
            } else {
                newCount++;
            }
            mergedMap.set(key, p);
        }

        const finalProducts = Array.from(mergedMap.values());

        // JSON 파일 저장
        await fs.writeFile(jsonPath, JSON.stringify(finalProducts, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `동기화 완료! 신규 ${newCount}개, 업데이트 ${updatedCount}개, 총 ${finalProducts.length}개 상품`,
            stats: {
                total: finalProducts.length,
                newProducts: newCount,
                updatedProducts: updatedCount,
                uploadedRows: products.length,
            },
            unmappedHeaders: unmappedHeaders.length > 0 ? unmappedHeaders : undefined,
        });
    } catch (error) {
        console.error('[무신사 동기화 오류]', error);
        const message = error instanceof Error ? error.message : '동기화에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
