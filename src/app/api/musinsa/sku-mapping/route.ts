// src/app/api/musinsa/sku-mapping/route.ts
// SKU 매핑 관리 API
// 무신사 품번코드-단품코드 ↔ ERP SKU 매핑

import { NextRequest, NextResponse } from 'next/server';
import {
    loadMappings,
    upsertMapping,
    deleteMapping,
    bulkImportMappings,
} from '@/services/sku-mapping.service';

// GET: 전체 매핑 목록 조회
export async function GET() {
    try {
        const mappings = await loadMappings();
        return NextResponse.json({ success: true, data: mappings });
    } catch (error) {
        const message = error instanceof Error ? error.message : '매핑 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST: 매핑 추가/수정 또는 엑셀 일괄 등록
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // ─── 엑셀 일괄 등록 모드 ───
        if (body.bulkImport && Array.isArray(body.rows)) {
            const result = await bulkImportMappings(body.rows, body.registeredBy || 'excel');
            return NextResponse.json({
                success: true,
                message: `매핑 등록 완료! 신규 ${result.newCount}건, 수정 ${result.updatedCount}건, 총 ${result.total}건`,
                stats: result,
            });
        }

        // ─── 단일 매핑 등록 모드 ───
        if (!body.musinsaProductCode || !body.erpSku) {
            return NextResponse.json(
                { error: '무신사 품번코드와 ERP SKU는 필수입니다.' },
                { status: 400 }
            );
        }

        const mapping = {
            musinsaProductCode: body.musinsaProductCode,
            musinsaOptionCode: body.musinsaOptionCode || '',
            musinsaProductName: body.musinsaProductName || '',
            erpSku: body.erpSku,
            erpProductName: body.erpProductName || '',
            mappedAt: new Date().toISOString().split('T')[0],
            mappedBy: body.mappedBy || 'manual',
        };

        const result = await upsertMapping(mapping);
        return NextResponse.json({
            success: true,
            message: result.isNew ? '매핑이 등록되었습니다.' : '매핑이 수정되었습니다.',
            isNew: result.isNew,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '매핑 등록 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE: 매핑 삭제
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const productCode = searchParams.get('productCode');
        const optionCode = searchParams.get('optionCode') || '';

        if (!productCode) {
            return NextResponse.json(
                { error: '품번코드(productCode)는 필수입니다.' },
                { status: 400 }
            );
        }

        const deleted = await deleteMapping(productCode, optionCode);
        if (!deleted) {
            return NextResponse.json(
                { error: '해당 매핑을 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: '매핑이 삭제되었습니다.' });
    } catch (error) {
        const message = error instanceof Error ? error.message : '매핑 삭제 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
