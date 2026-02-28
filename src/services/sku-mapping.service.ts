// src/services/sku-mapping.service.ts
// SKU 매핑 서비스
// 무신사 '품번코드-단품코드' ↔ ERP 'SKU' 1:1 매핑 관리
// 무신사는 상품 자동 수집을 지원하지 않으므로, 수동/엑셀 매핑이 필수

import { promises as fs } from 'fs';
import path from 'path';
import type { SkuMapping, RawOrderItem } from '@/channels/types';

// SKU 매핑 데이터 저장 경로 (JSON 파일 기반)
const MAPPING_FILE = path.join(process.cwd(), 'public', 'data', 'sku-mappings.json');

// ─── 매핑 파일 읽기 ───
export async function loadMappings(): Promise<SkuMapping[]> {
    try {
        const raw = await fs.readFile(MAPPING_FILE, 'utf-8');
        return JSON.parse(raw) as SkuMapping[];
    } catch {
        // 파일이 없으면 빈 배열로 시작
        return [];
    }
}

// ─── 매핑 파일 저장 ───
export async function saveMappings(mappings: SkuMapping[]): Promise<void> {
    // 디렉토리가 없으면 생성
    const dir = path.dirname(MAPPING_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(MAPPING_FILE, JSON.stringify(mappings, null, 2), 'utf-8');
}

// ─── 단일 매핑 추가/수정 ───
// 무신사 품번+단품코드 조합이 이미 있으면 업데이트, 없으면 추가
export async function upsertMapping(mapping: SkuMapping): Promise<{ isNew: boolean }> {
    const mappings = await loadMappings();
    const key = `${mapping.musinsaProductCode}_${mapping.musinsaOptionCode}`;

    const existingIndex = mappings.findIndex(
        m => `${m.musinsaProductCode}_${m.musinsaOptionCode}` === key
    );

    if (existingIndex >= 0) {
        // 기존 매핑 업데이트
        mappings[existingIndex] = { ...mappings[existingIndex], ...mapping };
        await saveMappings(mappings);
        return { isNew: false };
    } else {
        // 신규 매핑 추가
        mappings.push(mapping);
        await saveMappings(mappings);
        return { isNew: true };
    }
}

// ─── 매핑 삭제 ───
export async function deleteMapping(
    musinsaProductCode: string,
    musinsaOptionCode: string
): Promise<boolean> {
    const mappings = await loadMappings();
    const key = `${musinsaProductCode}_${musinsaOptionCode}`;
    const filtered = mappings.filter(
        m => `${m.musinsaProductCode}_${m.musinsaOptionCode}` !== key
    );

    if (filtered.length === mappings.length) return false; // 삭제할 것 없음

    await saveMappings(filtered);
    return true;
}

// ─── 엑셀 데이터로 일괄 매핑 등록 ───
// 엑셀 헤더: 무신사품번코드, 무신사단품코드, 무신사상품명, ERP_SKU, ERP상품명
export async function bulkImportMappings(
    rows: Record<string, string>[],
    registeredBy: string = 'excel_import'
): Promise<{ total: number; newCount: number; updatedCount: number; errors: string[] }> {
    const mappings = await loadMappings();
    const existingMap = new Map<string, number>();

    // 기존 매핑을 Map으로 인덱싱
    mappings.forEach((m, i) => {
        existingMap.set(`${m.musinsaProductCode}_${m.musinsaOptionCode}`, i);
    });

    let newCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // 엑셀 헤더명 유연 매핑
    const headerMap: Record<string, string> = {
        '무신사품번코드': 'musinsaProductCode', '품번코드': 'musinsaProductCode', '품번': 'musinsaProductCode',
        'goods_no': 'musinsaProductCode', '상품번호': 'musinsaProductCode',
        '무신사단품코드': 'musinsaOptionCode', '단품코드': 'musinsaOptionCode', '옵션코드': 'musinsaOptionCode',
        'option_no': 'musinsaOptionCode',
        '무신사상품명': 'musinsaProductName', '상품명': 'musinsaProductName', '제품명': 'musinsaProductName',
        'ERP_SKU': 'erpSku', 'SKU': 'erpSku', 'sku': 'erpSku', '자체품번': 'erpSku',
        'ERP상품명': 'erpProductName', 'ERP_상품명': 'erpProductName',
    };

    const now = new Date().toISOString().split('T')[0];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // 헤더 매핑
        const mapped: Record<string, string> = {};
        for (const [excelKey, value] of Object.entries(row)) {
            const field = headerMap[excelKey.trim()];
            if (field) mapped[field] = String(value || '').trim();
        }

        // 필수 필드 확인
        if (!mapped.musinsaProductCode || !mapped.erpSku) {
            errors.push(`${i + 2}번째 행: 품번코드 또는 ERP_SKU가 비어있습니다.`);
            continue;
        }

        const newMapping: SkuMapping = {
            musinsaProductCode: mapped.musinsaProductCode,
            musinsaOptionCode: mapped.musinsaOptionCode || '',
            musinsaProductName: mapped.musinsaProductName || '',
            erpSku: mapped.erpSku,
            erpProductName: mapped.erpProductName || '',
            mappedAt: now,
            mappedBy: registeredBy,
        };

        const key = `${newMapping.musinsaProductCode}_${newMapping.musinsaOptionCode}`;
        const existingIdx = existingMap.get(key);

        if (existingIdx !== undefined) {
            mappings[existingIdx] = newMapping;
            updatedCount++;
        } else {
            mappings.push(newMapping);
            existingMap.set(key, mappings.length - 1);
            newCount++;
        }
    }

    await saveMappings(mappings);

    return {
        total: mappings.length,
        newCount,
        updatedCount,
        errors,
    };
}

// ─── 주문 아이템에 ERP SKU 매핑 적용 ───
// 수집된 주문의 각 상품에 대해 ERP SKU를 찾아서 매핑
// 매핑 안 된 상품은 isMapped = false로 표시 → 미등록 상품 경고
export async function applyMappingToItems(
    items: RawOrderItem[]
): Promise<{ mappedItems: RawOrderItem[]; unmappedCount: number }> {
    const mappings = await loadMappings();

    // 빠른 검색을 위한 Map 생성
    const mappingMap = new Map<string, SkuMapping>();
    for (const m of mappings) {
        // 품번코드+단품코드 조합으로 검색
        mappingMap.set(`${m.musinsaProductCode}_${m.musinsaOptionCode}`, m);
        // 품번코드만으로도 검색 가능 (단품코드 없을 때 fallback)
        if (!mappingMap.has(`${m.musinsaProductCode}_`)) {
            mappingMap.set(`${m.musinsaProductCode}_`, m);
        }
    }

    let unmappedCount = 0;

    const mappedItems: RawOrderItem[] = items.map(item => {
        const productCode = item.externalProductId || '';
        const optionCode = item.externalSkuId || '';

        // 1차: 품번+단품 정확 매칭
        let mapping = mappingMap.get(`${productCode}_${optionCode}`);

        // 2차: 품번만으로 매칭 (단품코드 없는 경우)
        if (!mapping) {
            mapping = mappingMap.get(`${productCode}_`);
        }

        if (mapping) {
            return {
                ...item,
                mappedErpSku: mapping.erpSku,
                isMapped: true,
            };
        } else {
            unmappedCount++;
            return {
                ...item,
                isMapped: false,
            };
        }
    });

    return { mappedItems, unmappedCount };
}
