// src/app/api/musinsa/claims/route.ts
// 무신사 CS(클레임) 조회 API — 읽기 전용
// 취소/반품/교환은 조회만 가능, 처리는 무신사 파트너센터에서 직접

import { NextResponse } from 'next/server';
import { MusinsaAdapter, MusinsaApiError } from '@/channels/musinsa.adapter';
import { promises as fs } from 'fs';
import path from 'path';

const CLAIMS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-claims.json');

// GET: 저장된 CS 데이터 조회
export async function GET() {
    try {
        const raw = await fs.readFile(CLAIMS_FILE, 'utf-8');
        const claims = JSON.parse(raw);
        return NextResponse.json({ success: true, data: claims });
    } catch {
        return NextResponse.json({ success: true, data: [] });
    }
}

// POST: 무신사에서 CS 데이터 새로 조회
export async function POST() {
    try {
        const adapter = new MusinsaAdapter({
            apiKey: process.env.MUSINSA_API_KEY || '',
            baseUrl: process.env.MUSINSA_API_BASE_URL || '',
        });

        // 최근 30일 CS 조회
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const claims = await adapter.fetchClaims(since);

        // 저장
        const dir = path.dirname(CLAIMS_FILE);
        await fs.mkdir(dir, { recursive: true });

        const claimsWithMeta = claims.map(c => ({
            ...c,
            syncedAt: new Date().toISOString(),
            // ⚠️ 읽기 전용 플래그 — UI에서 경고 표시에 사용
            readOnly: true,
            partnerCenterNote: '반품/교환 처리는 무신사 스토어 파트너센터에서 직접 진행해 주세요.',
        }));

        await fs.writeFile(CLAIMS_FILE, JSON.stringify(claimsWithMeta, null, 2), 'utf-8');

        // 타입별 카운트
        const cancelCount = claims.filter(c => c.claimType === 'CANCEL').length;
        const returnCount = claims.filter(c => c.claimType === 'RETURN').length;
        const exchangeCount = claims.filter(c => c.claimType === 'EXCHANGE').length;

        return NextResponse.json({
            success: true,
            message: `CS 조회 완료! 취소 ${cancelCount}건, 반품 ${returnCount}건, 교환 ${exchangeCount}건`,
            stats: { total: claims.length, cancelCount, returnCount, exchangeCount },
        });
    } catch (error) {
        if (error instanceof MusinsaApiError) {
            return NextResponse.json(
                { error: error.message, code: error.statusCode },
                { status: error.statusCode || 500 }
            );
        }
        const message = error instanceof Error ? error.message : 'CS 조회에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
