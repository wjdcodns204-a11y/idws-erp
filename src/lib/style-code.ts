// src/lib/style-code.ts
// 스타일 코드 및 SKU 자동 생성 유틸리티

import { prisma } from './prisma';

// ─── 사이즈 → 접미사 매핑 (확정 정책 + 확장) ───
export const SIZE_MAP: Record<string, { suffix: string; label: string }> = {
    '0': { suffix: '_A', label: 'S' },
    '1': { suffix: '_B', label: 'M' },
    '2': { suffix: '_C', label: 'L' },
    '3': { suffix: '_D', label: 'XL' },    // 확장 예비
    '4': { suffix: '_E', label: 'XXL' },   // 확장 예비
    'OS': { suffix: '_F', label: 'FREE' },
};

// 역방향 매핑: 접미사 → 사이즈
export const SUFFIX_TO_SIZE: Record<string, { value: string; label: string }> = {
    '_A': { value: '0', label: 'S' },
    '_B': { value: '1', label: 'M' },
    '_C': { value: '2', label: 'L' },
    '_D': { value: '3', label: 'XL' },
    '_E': { value: '4', label: 'XXL' },
    '_F': { value: 'OS', label: 'FREE' },
};

/**
 * 스타일 코드 자동 생성
 * 포맷: I + 연도(2자리) + 시즌(SS/FW) + 복종코드(2자리) + 일련번호(3자리)
 * 예: I25SSPT001, I25SSJK002
 */
export async function generateStyleCode(
    year: number,
    season: 'SS' | 'FW',
    categoryCode: string,
): Promise<string> {
    const yearStr = String(year).slice(-2);
    const prefix = `I${yearStr}${season}${categoryCode}`;

    // DB에서 해당 접두사의 마지막 일련번호 조회
    const lastProduct = await prisma.product.findFirst({
        where: { styleCode: { startsWith: prefix } },
        orderBy: { styleCode: 'desc' },
        select: { styleCode: true },
    });

    let nextSerial = 1;
    if (lastProduct) {
        const lastSerial = parseInt(lastProduct.styleCode.slice(-3), 10);
        if (!isNaN(lastSerial)) {
            nextSerial = lastSerial + 1;
        }
    }

    if (nextSerial > 999) {
        throw new Error(
            `[코드 생성 오류] ${prefix} 일련번호가 한도(999)를 초과했습니다. ` +
            `현재 시즌·카테고리에 더 이상 상품을 등록할 수 없습니다.`
        );
    }

    return `${prefix}${String(nextSerial).padStart(3, '0')}`;
}

/**
 * SKU 코드 자동 생성 (사이즈 선택 시)
 * 포맷: {스타일코드}-{색상코드}{사이즈접미사}
 * 예: I25SSJK001-BK_A (Black, S사이즈)
 */
export function generateSKUs(
    styleCode: string,
    colorCode: string,
    sizes: string[],
): Array<{
    skuCode: string;
    size: string;
    sizeLabel: string;
    sizeSuffix: string;
}> {
    return sizes.map((size) => {
        const mapping = SIZE_MAP[size];
        if (!mapping) {
            throw new Error(
                `[SKU 생성 오류] 정의되지 않은 사이즈: "${size}". ` +
                `허용된 값: ${Object.keys(SIZE_MAP).join(', ')}`
            );
        }

        return {
            skuCode: `${styleCode}-${colorCode}${mapping.suffix}`,
            size,
            sizeLabel: mapping.label,
            sizeSuffix: mapping.suffix,
        };
    });
}

/**
 * 아울렛 여부 자동 판별
 * 판매가가 Tag가(정가) 대비 50% 이상 할인 → is_outlet = true
 */
export function isOutletPrice(tagPrice: number, sellingPrice: number): boolean {
    if (tagPrice <= 0) return false;
    return sellingPrice <= tagPrice * 0.5;
}

/**
 * 할인율 계산 (정수 %)
 */
export function calcDiscountRate(tagPrice: number, sellingPrice: number): number {
    if (tagPrice <= 0) return 0;
    return Math.round((1 - sellingPrice / tagPrice) * 100);
}

/**
 * 색상 코드 → 한글 색상명 추론
 */
export function inferColorName(colorCode: string): string {
    const COLOR_NAME_MAP: Record<string, string> = {
        BK: '블랙', BR: '브라운', IV: '아이보리', WH: '화이트',
        NV: '네이비', GR: '그레이', BG: '베이지', KH: '카키',
        GN: '그린', RD: '레드', BL: '블루', PK: '핑크',
        CR: '크림', CH: '차콜', MT: '멀티', SL: '실버',
        GD: '골드', OR: '오렌지', YL: '옐로우', PP: '퍼플',
        OV: '올리브', DN: '데님', LV: '라벤더', MN: '민트',
    };
    return COLOR_NAME_MAP[colorCode.toUpperCase()] || colorCode;
}
