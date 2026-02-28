// src/app/api/products/sync-status/route.ts
// 상품 상태 동기화 — 이지어드민 스크래핑 방식
// 이지어드민에 로그인 → 상품현황 페이지에서 판매상태 수집 → musinsa-products.json 업데이트
// OTP 불필요 (이지어드민은 ID/PW만으로 로그인 가능)

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const PRODUCTS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-products.json');

// ─── 상품 데이터 타입 ───
interface LocalProduct {
    musinsaCode: string;
    name: string;
    status: string;
    store: string;
    styleCode: string;
    sellingPrice?: number;
    tagPrice?: number;
    [key: string]: unknown;
}

// ─── GET: 동기화 방식 확인 ───
export async function GET() {
    return NextResponse.json({
        method: 'ezadmin',
        description: '이지어드민 상품현황 페이지에서 상품 상태를 자동 가져옵니다',
        hasApiKey: true, // 이지어드민은 항상 사용 가능 (OTP 불필요)
    });
}

// ─── POST: 상품 상태 동기화 실행 ───
export async function POST() {
    try {
        console.log('[상태 동기화] 이지어드민 방식으로 실행...');

        // 이지어드민에서 상품 상태 스크래핑
        const { scrapeProductStatus } = await import('@/services/ezadmin-scraper');
        const result = await scrapeProductStatus();

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || '이지어드민 스크래핑 실패',
                method: 'ezadmin',
            }, { status: 500 });
        }

        if (result.data.length === 0) {
            return NextResponse.json({
                success: false,
                error: '상품 데이터를 수집하지 못했습니다. 이지어드민 상품현황 페이지를 확인해 주세요.',
                method: 'ezadmin',
                currentUrl: result.currentUrl,
            }, { status: 404 });
        }

        // ─── 기존 상품 데이터 로드 ───
        let localProducts: LocalProduct[] = [];
        try {
            const raw = await fs.readFile(PRODUCTS_FILE, 'utf-8');
            localProducts = JSON.parse(raw);
        } catch {
            return NextResponse.json({ success: false, error: '상품 데이터 파일(musinsa-products.json) 없음' }, { status: 404 });
        }

        // ─── 매칭 및 업데이트 ───
        let updated = 0;
        let matched = 0;
        const changes: { name: string; oldStatus: string; newStatus: string; priceChanged?: boolean }[] = [];

        for (const product of localProducts) {
            // 매칭 기준: 상품코드(musinsaCode) → 품번(styleCode) → 상품명 부분일치
            const match = result.data.find(s =>
                (s.goodsNo && s.goodsNo === product.musinsaCode) ||
                (s.styleCode && s.styleCode === product.styleCode) ||
                (s.goodsName && product.name && s.goodsName.includes(product.name))
            );
            if (!match) continue;
            matched++;

            const statusChanged = product.status !== match.status || product.store !== match.store;
            const priceChanged = (match.sellingPrice > 0 && product.sellingPrice !== match.sellingPrice) ||
                (match.tagPrice > 0 && product.tagPrice !== match.tagPrice);

            if (statusChanged || priceChanged) {
                changes.push({
                    name: product.name,
                    oldStatus: `${product.status}${product.store === 'outlet' ? ' (아울렛)' : ''}`,
                    newStatus: `${match.status}${match.store === 'outlet' ? ' (아울렛)' : ''}`,
                    priceChanged,
                });

                if (statusChanged) {
                    product.status = match.status;
                    product.store = match.store;
                }
                if (match.sellingPrice > 0) product.sellingPrice = match.sellingPrice;
                if (match.tagPrice > 0) product.tagPrice = match.tagPrice;

                updated++;
            }
        }

        // ─── 상태별 통계 ───
        const statusCounts: Record<string, number> = {};
        for (const p of localProducts) {
            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        }

        // ─── 저장 ───
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(localProducts, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            method: 'ezadmin',
            message: `이지어드민 동기화 완료! ${result.data.length}건 수집, ${matched}건 매칭, ${updated}건 변경`,
            stats: {
                scraped: result.data.length,
                local: localProducts.length,
                matched,
                updated,
                statusCounts,
            },
            changes: changes.slice(0, 30),
        });
    } catch (error) {
        console.error('[상태 동기화 오류]', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '동기화 실패',
            method: 'ezadmin',
        }, { status: 500 });
    }
}
