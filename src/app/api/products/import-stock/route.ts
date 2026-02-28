// src/app/api/products/import-stock/route.ts
// 집계장 구글시트 "재고조회(현)" 탭에서 사이즈별 재고 데이터를 가져와 상품에 반영
// 시트 gid: 1905868369

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SHEET_ID = '1ZUZbBGDhZlTcCh-6VtpX3Y29uk5iI2aVyCv08zuqCXw';
const GID = '1905868369'; // 재고조회(현) 탭
const PRODUCTS_FILE = path.join(process.cwd(), 'public', 'data', 'musinsa-products.json');

// CSV 파싱 — 따옴표 안 쉼표 처리
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += ch; }
    }
    result.push(current.trim());
    return result;
}

// 사이즈 코드 해석 (바코드 마지막 _A, _B, _C, _F 또는 옵션 [0],[1],[2],[OS])
function parseSizeLabel(option: string, barcodeSuffix: string): string {
    // 옵션 값 기반 (예: "[0]", "[1]", "[2]", "[OS]")
    const optMatch = option.match(/\[(\w+)\]/);
    if (optMatch) {
        const val = optMatch[1];
        if (val === 'OS' || val === 'F') return 'OS';
        // 숫자형 사이즈는 실제 사이즈명으로 (S=0, M=1, L=2, XL=3)
        const sizeMap: Record<string, string> = { '0': 'S', '1': 'M', '2': 'L', '3': 'XL', '4': 'XXL' };
        return sizeMap[val] || val;
    }
    // 바코드 접미사 기반 (예: _A=S, _B=M, _C=L, _F=OS)
    const suffixMap: Record<string, string> = { 'A': 'S', 'B': 'M', 'C': 'L', 'D': 'XL', 'F': 'OS' };
    return suffixMap[barcodeSuffix] || barcodeSuffix || 'OS';
}

// 사이즈별 재고 인터페이스
interface SizeStock {
    size: string;
    stock: number;
    defective: number;
    available: number;
}

export async function POST() {
    try {
        // 구글 시트 CSV 다운로드
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
        const response = await fetch(csvUrl, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) throw new Error(`재고 시트 다운로드 실패 (${response.status})`);

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(l => l.trim());

        if (lines.length < 2) {
            return NextResponse.json({ error: '재고 데이터가 비어있습니다.' }, { status: 400 });
        }

        // ─── CSV 컬럼 구조 (실측) ───
        // col 0: 공급처상품명 (=품번, 23F02DJ001-BK)
        // col 1: 바코드 (23F02DJ001-BK_A)
        // col 2: 상품명
        // col 3: 옵션 ([0], [1], [2], [OS] 등 사이즈)
        // col 4: 정상재고
        // col 5: 불량재고
        // col 6: 가용재고

        // 품번별 사이즈 재고 수집
        const stockMap = new Map<string, {
            totalStock: number;
            totalAvailable: number;
            sizes: SizeStock[];
        }>();

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 7) continue;

            const styleCode = (cols[0] || '').trim();  // 품번
            const barcode = (cols[1] || '').trim();
            const option = (cols[3] || '').trim();      // [0], [1], [2], [OS]
            const stock = parseInt(cols[4]) || 0;
            const defective = parseInt(cols[5]) || 0;
            const available = parseInt(cols[6]) || 0;

            if (!styleCode) continue;

            // 사이즈 라벨 결정
            const barcodeSuffix = barcode.split('_').pop() || '';
            const sizeLabel = parseSizeLabel(option, barcodeSuffix);

            if (!stockMap.has(styleCode)) {
                stockMap.set(styleCode, { totalStock: 0, totalAvailable: 0, sizes: [] });
            }

            const entry = stockMap.get(styleCode)!;
            entry.totalStock += stock;
            entry.totalAvailable += available;
            entry.sizes.push({
                size: sizeLabel,
                stock,
                defective,
                available,
            });
        }

        // ─── 상품 데이터에 재고 반영 ───
        const raw = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        const products = JSON.parse(raw) as Array<Record<string, unknown>>;

        let matched = 0;
        let unmatched = 0;

        for (const product of products) {
            const styleCode = product.styleCode as string;
            const stockData = stockMap.get(styleCode);

            if (stockData) {
                product.stock = stockData.totalStock;
                product.availableStock = stockData.totalAvailable;
                product.sizeStock = stockData.sizes;
                matched++;
            } else {
                unmatched++;
            }
        }

        // 저장
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `재고 반영 완료! 매칭: ${matched}개, 미매칭: ${unmatched}개 (총 ${stockMap.size}개 SKU)`,
            stats: {
                totalSkuRows: lines.length - 1,
                uniqueStyleCodes: stockMap.size,
                matched,
                unmatched,
                totalProducts: products.length,
            },
        });
    } catch (error) {
        console.error('[재고 가져오기 오류]', error);
        const message = error instanceof Error ? error.message : '재고 가져오기 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
