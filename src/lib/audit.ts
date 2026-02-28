// src/lib/audit.ts
// PII 데이터 열람/수정 시 감사 로그를 DB에 기록하는 유틸리티

import { prisma } from './prisma';

interface AuditLogParams {
    userId: string;
    action: 'VIEW_PII' | 'UPDATE_PII' | 'DECRYPT' | 'EXPORT';
    tableName: string;
    recordId: string;
    fieldName?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
}

/**
 * 감사 로그를 DB에 기록합니다.
 * PII 데이터 열람/수정 시 반드시 호출해야 합니다.
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                tableName: params.tableName,
                recordId: params.recordId,
                fieldName: params.fieldName ?? null,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
                details: params.details ?? null,
            },
        });
    } catch (error) {
        // 감사 로그 실패가 비즈니스 로직을 중단시키면 안 됨
        // 대신 서버 로그에 기록
        console.error('[감사 로그 기록 실패]', error);
    }
}

/**
 * PII 필드를 복호화하면서 동시에 감사 로그를 남기는 헬퍼
 */
export async function decryptWithAudit(
    ciphertext: string,
    params: Omit<AuditLogParams, 'action'>
): Promise<string> {
    const { decryptPII } = await import('./encryption');

    // 감사 로그 먼저 기록
    await createAuditLog({
        ...params,
        action: 'DECRYPT',
    });

    return decryptPII(ciphertext);
}
