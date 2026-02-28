// src/app/api/products/images/route.ts
// 공유 드라이브의 제품컷(보정) 폴더에서 상품 이미지를 찾아 제공하는 API
// 경로 구조: G:\공유 드라이브\IDWS\상세페이지\{시즌}\{카테고리}\{상품명}\제품컷(보정)\

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ─── 상세페이지 루트 경로 ───
const BASE_DIR = 'G:\\공유 드라이브\\IDWS\\상세페이지';

// 시즌 폴더들 (우선순위: 최신 → 오래된 순)
const SEASONS = ['26SS', '25FW', '25SS', '24FW', '24SS', '23FW', '23SS', '2022'];
// 카테고리 폴더들
const CATEGORIES = ['Top', 'Bottom', 'Outer', 'Acc', '셀렉용'];

// ─── 이미지 캐시 (서버 메모리에 보관) ───
let imageCache: Map<string, string> | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1시간

// ─── 전체 상품 이미지 맵 빌드 ───
function buildImageMap(): Map<string, string> {
    const map = new Map<string, string>();

    for (const season of SEASONS) {
        for (const cat of CATEGORIES) {
            const catDir = path.join(BASE_DIR, season, cat);
            if (!fs.existsSync(catDir)) continue;

            try {
                const productFolders = fs.readdirSync(catDir, { withFileTypes: true });
                for (const folder of productFolders) {
                    if (!folder.isDirectory()) continue;
                    const productName = folder.name;

                    // 이미 더 최신 시즌에서 매핑된 상품은 건너뜀
                    if (map.has(productName)) continue;

                    // 제품컷(보정) 폴더 먼저, 없으면 제품컷 폴더
                    const cutDirs = ['제품컷(보정)', '제품컷', '제품컷(원본)'];
                    for (const cutDir of cutDirs) {
                        const imgDir = path.join(catDir, productName, cutDir);
                        if (!fs.existsSync(imgDir)) continue;

                        try {
                            const files = fs.readdirSync(imgDir)
                                .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                                .sort(); // 1.jpg, 2.jpg, ... 순서
                            if (files.length > 0) {
                                map.set(productName, path.join(imgDir, files[0]));
                                break;
                            }
                        } catch { /* 읽기 실패 무시 */ }
                    }
                }
            } catch { /* 디렉토리 읽기 실패 무시 */ }
        }
    }

    console.log(`[이미지 맵] ${map.size}개 상품 이미지 매핑 완료`);
    return map;
}

function getImageMap(): Map<string, string> {
    const now = Date.now();
    if (!imageCache || now - lastCacheTime > CACHE_TTL) {
        imageCache = buildImageMap();
        lastCacheTime = now;
    }
    return imageCache;
}

// ─── GET: 상품 이미지 제공 ───
// /api/products/images?name=Cross Layered Sweat Pants Black
export async function GET(req: NextRequest) {
    const productName = req.nextUrl.searchParams.get('name');

    if (!productName) {
        return NextResponse.json({ error: 'name 파라미터 필요' }, { status: 400 });
    }

    const map = getImageMap();

    // 정확한 이름 매칭
    let imagePath = map.get(productName);

    // 부분 매칭 시도 (상품명이 폴더명을 포함하거나 반대)
    if (!imagePath) {
        const nameLower = productName.toLowerCase();
        for (const [folderName, filePath] of map.entries()) {
            if (folderName.toLowerCase().includes(nameLower) || nameLower.includes(folderName.toLowerCase())) {
                imagePath = filePath;
                break;
            }
        }
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
        return NextResponse.json({ error: '이미지 없음' }, { status: 404 });
    }

    // 이미지 파일 읽어서 반환
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
    };
    const contentType = mimeTypes[ext] || 'image/jpeg';

    const imageBuffer = fs.readFileSync(imagePath);

    return new NextResponse(imageBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400', // 24시간 캐시
        },
    });
}
