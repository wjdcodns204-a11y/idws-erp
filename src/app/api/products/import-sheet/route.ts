// src/app/api/products/import-sheet/route.ts
// 구글 시트 "제품정보 통합 RD"에서 상품 데이터를 가져와 JSON으로 저장
// 시트 ID: 1ZUZbBGDhZlTcCh-6VtpX3Y29uk5iI2aVyCv08zuqCXw
// 탭 gid: 1568589906

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SHEET_ID = '1ZUZbBGDhZlTcCh-6VtpX3Y29uk5iI2aVyCv08zuqCXw';
const GID = '1568589906'; // 제품정보 통합 RD 탭
const PRODUCTS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-products.json');

// CSV 파싱 유틸 — 쉼표 안 따옴표 처리
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// 금액 문자열 → 숫자
function parsePrice(v: string): number {
    if (!v) return 0;
    return Number(v.replace(/[,원₩\s"]/g, '')) || 0;
}

// 스타일코드에서 카테고리 추출 (예: 23F02DJ001 → DJ → 카테고리)
// 상품관리 페이지의 CATEGORY_MAP과 반드시 일치해야 함
function extractCategory(styleCode: string): string {
    const match = styleCode.match(/\d{2}[A-Z]\d{2}([A-Z]{2})\d+/);
    if (!match) return '액세서리';
    const code = match[1];
    // 무신사 카테고리 체계와 일치하는 한글 명칭 사용
    const map: Record<string, string> = {
        // OUTER 그룹
        'JK': '자켓', 'CT': '코트', 'PD': '패딩', 'PK': '파카',
        'VT': '조끼', 'DJ': '자켓', 'CD': '가디건', 'JP': '점퍼',
        // TOP 그룹
        'HD': '후드 티셔츠', 'HZ': '후드 티셔츠', 'NT': '니트',
        'SW': '맨투맨', 'TS': '반소매 티셔츠', 'SH': '셔츠',
        'BL': '블라우스',
        // BOTTOM 그룹
        'DP': '데님 팬츠', 'LP': '코튼 팬츠', 'PN': '바지',
        'BP': '숏팬츠', 'SP': '숏팬츠', 'SK': '스커트',
        // ACC 그룹
        'BC': '모자', 'AC': '액세서리', 'MT': '머플러', 'BG': '가방',
        'SC': '스카프', 'GL': '장갑', 'BT': '벨트', 'HT': '모자',
        'WL': '지갑', 'MB': '모자',
    };
    return map[code] || '액세서리';
}

export async function POST() {
    try {
        // 구글 시트 CSV 내보내기
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

        const response = await fetch(csvUrl, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(30000), // 30초 타임아웃
        });

        if (!response.ok) {
            throw new Error(`구글 시트 다운로드 실패 (${response.status})`);
        }

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(l => l.trim());

        if (lines.length < 2) {
            return NextResponse.json({ error: '시트에 데이터가 없습니다.' }, { status: 400 });
        }

        // 헤더 파싱
        const headers = parseCSVLine(lines[0]);
        console.log('[상품 가져오기] 헤더:', headers);

        // ─── CSV 컬럼 구조 (실측 기반) ───
        // col 0: 무신사 상품명 (영문)
        // col 1: 사이즈 제외 품번 (23F02DJ001-BK)
        // col 2: 시즌 (23FW)
        // col 3: 날짜변환 (2023-09-01)
        // col 4: 무신사 코드 (숫자, 예: 2222857)
        // col 5: 29cm 코드
        // col 6: 카페24 코드
        // col 7: EQL 코드
        // col 8: 제품명 (공백제거)
        // col 9: 제품명 (원본, 공백 있음)
        // col 10: 정가(vat포함)
        // col 11: 판매가(vat포함)
        // col 12: 판매가(vat제외)
        // col 13: 원가(vat+)
        // col 14: 원가(vat-)
        // col 15: 사이즈 제외 품번 (중복)
        // col 16: 컬러

        // 행 데이터 파싱 — 같은 품번은 하나로 합침
        const productMap = new Map<string, Record<string, unknown>>();

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 10) continue;

            // 사이즈 제외 품번 (col 1)
            const styleCode = (cols[1] || '').trim();

            if (!styleCode) continue;

            // 이미 등록된 품번이면 스킵 (사이즈별 중복 제거)
            if (productMap.has(styleCode)) continue;

            const season = (cols[2] || '').trim();
            const musinsaCode = (cols[4] || '').trim();   // 무신사 숫자코드 (예: 2222857)
            const code29cm = (cols[5] || '').trim();      // 29cm 코드
            const cafe24Code = (cols[6] || '').trim();    // 카페24 코드
            const eqlCode = (cols[7] || '').trim();       // EQL 코드
            const productName = (cols[9] || cols[0] || '').trim(); // 제품명 (공백 있는 원본)
            const tagPrice = parsePrice(cols[10] || '');
            const sellingPrice = parsePrice(cols[11] || '');
            const costPrice = parsePrice(cols[13] || '');

            // 컬러 추출 (품번의 끝 부분, 예: 23F02DJ001-BK → BK)
            const colorMatch = styleCode.match(/-([A-Z]{2,3})$/);
            const colorCode = colorMatch ? colorMatch[1] : '';
            const baseStyleCode = styleCode.replace(/-[A-Z]{2,3}$/, '');

            const category = extractCategory(styleCode);

            // 할인율 계산
            const discountRate = tagPrice > 0 && sellingPrice < tagPrice
                ? Math.round((1 - sellingPrice / tagPrice) * 100)
                : 0;

            // 수수료율 (무신사 기본 28%)
            const commissionRate = 28;

            productMap.set(styleCode, {
                musinsaCode,
                brand: 'IDWS',
                categoryL: '의류',
                categoryM: category,
                categoryS: '',
                styleCode,
                baseStyleCode,
                colorCode,
                imageUrl: `https://image.msscdn.net/images/goods_img/${musinsaCode}/`,
                name: productName,
                status: '판매중',
                tagPrice,
                sellingPrice: sellingPrice || tagPrice,
                stock: 0,
                availableStock: 0,
                costPrice,
                commissionRate,
                discountRate,
                store: '무신사',
                season,
                registeredAt: cols[3]?.trim() || '',
                origin: '국내',
                cafe24Code,
                code29cm,
                channelCodes: {
                    musinsa: musinsaCode,
                    cafe24: cafe24Code,
                    '29cm': code29cm,
                    eql: eqlCode,
                },
            });
        }

        const products = Array.from(productMap.values());

        // 저장
        const dir = path.dirname(PRODUCTS_FILE);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');

        // 시즌별 통계
        const seasonCounts: Record<string, number> = {};
        products.forEach(p => {
            const s = (p.season as string) || '미분류';
            seasonCounts[s] = (seasonCounts[s] || 0) + 1;
        });

        return NextResponse.json({
            success: true,
            message: `상품 ${products.length}개 가져오기 완료!`,
            stats: {
                totalProducts: products.length,
                totalRows: lines.length - 1,
                seasons: seasonCounts,
            },
        });
    } catch (error) {
        console.error('[상품 가져오기 오류]', error);
        const message = error instanceof Error ? error.message : '상품 가져오기 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// GET: 현재 저장된 상품 데이터 확인
export async function GET() {
    try {
        const raw = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        const products = JSON.parse(raw);
        return NextResponse.json({ success: true, count: products.length, data: products });
    } catch {
        return NextResponse.json({ success: true, count: 0, data: [] });
    }
}
