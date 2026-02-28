// src/app/api/orders/saved/route.ts
// 주문 데이터를 서버 컴퓨터의 파일(JSON)에 저장/불러오는 API
// 비유: 브라우저 서랍(localStorage) 대신 컴퓨터 하드디스크에 장부를 보관
// → 사이트를 껐다 켜도, 서버를 재시작해도 데이터가 남아 있음

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 데이터 저장 경로 — 프로젝트 폴더 안에 저장
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');

// ─── GET: 저장된 주문 데이터 불러오기 ───
export async function GET() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return NextResponse.json({ success: true, orders: [], savedAt: null });
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        return NextResponse.json({ success: true, ...data });
    } catch (err) {
        console.error('[저장된 주문 불러오기 오류]', err);
        return NextResponse.json({ success: false, orders: [], error: String(err) });
    }
}

// ─── POST: 주문 데이터를 파일에 저장 ───
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const orders = body.orders || [];

        // data 폴더가 없으면 생성
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // 저장 시간과 함께 기록
        const saveData = {
            orders,
            totalOrders: orders.length,
            savedAt: new Date().toISOString(),
        };

        fs.writeFileSync(DATA_FILE, JSON.stringify(saveData, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `${orders.length.toLocaleString()}건 주문 저장 완료`,
            savedAt: saveData.savedAt,
        });
    } catch (err) {
        console.error('[주문 저장 오류]', err);
        return NextResponse.json(
            { success: false, error: `저장 실패: ${err instanceof Error ? err.message : String(err)}` },
            { status: 500 }
        );
    }
}
