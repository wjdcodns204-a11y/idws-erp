// src/app/api/musinsa/settings/route.ts
// 무신사 API 설정 관리
// API 키, Base URL 저장, 연결 테스트

import { NextRequest, NextResponse } from 'next/server';
import { MusinsaAdapter, MusinsaApiError } from '@/channels/musinsa.adapter';
import { promises as fs } from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-settings.json');

interface MusinsaSettings {
    apiKey: string;
    baseUrl: string;
    lastTestResult?: string;
    lastTestDate?: string;
    agency?: string;
}

// GET: 설정 조회 (API 키 마스킹)
export async function GET() {
    try {
        const settings = await loadSettings();
        return NextResponse.json({
            success: true,
            data: {
                ...settings,
                // API 키는 앞 4자리만 표시, 나머지는 마스킹
                apiKey: settings.apiKey
                    ? settings.apiKey.substring(0, 4) + '****' + settings.apiKey.substring(settings.apiKey.length - 4)
                    : '',
                hasApiKey: !!settings.apiKey,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '설정 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST: 설정 저장 또는 연결 테스트
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // ─── 연결 테스트 모드 ───
        if (body.action === 'test') {
            const settings = await loadSettings();
            const apiKey = body.apiKey || settings.apiKey;
            const baseUrl = body.baseUrl || settings.baseUrl;

            if (!apiKey) {
                return NextResponse.json(
                    { error: 'API 키를 먼저 입력해 주세요.' },
                    { status: 400 }
                );
            }

            try {
                const adapter = new MusinsaAdapter({ apiKey, baseUrl });
                await adapter.authenticate();

                // 테스트 성공 → 결과 저장
                const updatedSettings = {
                    ...settings,
                    apiKey,
                    baseUrl,
                    lastTestResult: '✅ 연결 성공',
                    lastTestDate: new Date().toISOString(),
                };
                await saveSettings(updatedSettings);

                return NextResponse.json({
                    success: true,
                    message: '✅ 무신사 API 연결 테스트 성공!',
                });
            } catch (testError) {
                // 테스트 실패 결과도 저장 (디버깅용)
                const errorMsg = testError instanceof MusinsaApiError
                    ? testError.message
                    : (testError instanceof Error ? testError.message : '연결 실패');

                const updatedSettings = {
                    ...settings,
                    apiKey,
                    baseUrl,
                    lastTestResult: `❌ ${errorMsg}`,
                    lastTestDate: new Date().toISOString(),
                };
                await saveSettings(updatedSettings);

                return NextResponse.json({
                    success: false,
                    error: errorMsg,
                });
            }
        }

        // ─── 설정 저장 모드 ───
        const settings = await loadSettings();
        const updated: MusinsaSettings = {
            ...settings,
            apiKey: body.apiKey !== undefined ? body.apiKey : settings.apiKey,
            baseUrl: body.baseUrl !== undefined ? body.baseUrl : settings.baseUrl,
            agency: body.agency !== undefined ? body.agency : settings.agency,
        };

        await saveSettings(updated);

        return NextResponse.json({
            success: true,
            message: '설정이 저장되었습니다.',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '설정 저장 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ─── 설정 파일 읽기/쓰기 ───
async function loadSettings(): Promise<MusinsaSettings> {
    try {
        const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        // 기본값: 환경변수에서 가져오기
        return {
            apiKey: process.env.MUSINSA_API_KEY || '',
            baseUrl: process.env.MUSINSA_API_BASE_URL || 'https://bizest.musinsa.com',
        };
    }
}

async function saveSettings(settings: MusinsaSettings): Promise<void> {
    const dir = path.dirname(SETTINGS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}
