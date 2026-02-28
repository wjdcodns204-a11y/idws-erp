// src/lib/order-state.ts
// 주문 상태 머신 — 허용된 전환만 통과, 비정상 전환 차단

// 주문 상태 열거형 (Prisma 스키마와 동기화)
export type OrderStatus =
    | 'PAYMENT_COMPLETED'
    | 'PREPARING'
    | 'SHIPPED'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | 'PURCHASE_CONFIRMED'
    | 'CANCEL_REQUESTED'
    | 'CANCELLED'
    | 'RETURN_REQUESTED'
    | 'RETURNED'
    | 'EXCHANGE_REQUESTED'
    | 'EXCHANGED';

/**
 * 주문 상태별 한글 라벨
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    PAYMENT_COMPLETED: '결제완료',
    PREPARING: '상품준비중',
    SHIPPED: '배송시작(출고)',
    IN_TRANSIT: '배송중',
    DELIVERED: '배송완료',
    PURCHASE_CONFIRMED: '구매확정',
    CANCEL_REQUESTED: '취소요청',
    CANCELLED: '취소완료',
    RETURN_REQUESTED: '반품요청',
    RETURNED: '반품완료',
    EXCHANGE_REQUESTED: '교환요청',
    EXCHANGED: '교환완료',
};

/**
 * 허용된 상태 전환 맵
 * key: 현재 상태, value: 전환 가능한 다음 상태 목록
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PAYMENT_COMPLETED: ['PREPARING', 'CANCEL_REQUESTED'],
    PREPARING: ['SHIPPED', 'CANCEL_REQUESTED'],
    SHIPPED: ['IN_TRANSIT'],
    IN_TRANSIT: ['DELIVERED'],
    DELIVERED: ['PURCHASE_CONFIRMED', 'RETURN_REQUESTED', 'EXCHANGE_REQUESTED'],
    PURCHASE_CONFIRMED: [], // 최종 상태
    CANCEL_REQUESTED: ['CANCELLED'],
    CANCELLED: [], // 최종 상태
    RETURN_REQUESTED: ['RETURNED'],
    RETURNED: [], // 최종 상태
    EXCHANGE_REQUESTED: ['EXCHANGED'],
    EXCHANGED: [], // 최종 상태
};

/**
 * 재고 복원이 필요한 상태 목록
 */
export const INVENTORY_RESTORE_STATUSES: OrderStatus[] = ['CANCELLED', 'RETURNED'];

/**
 * 최종 상태 (더 이상 전환 불가) 목록
 */
export const TERMINAL_STATUSES: OrderStatus[] = [
    'PURCHASE_CONFIRMED',
    'CANCELLED',
    'RETURNED',
    'EXCHANGED',
];

/**
 * 상태 전환이 허용되는지 검증합니다.
 * @throws Error 허용되지 않는 전환일 경우
 */
export function validateTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
): void {
    const allowed = ALLOWED_TRANSITIONS[currentStatus];

    if (!allowed) {
        throw new Error(`[상태 머신 오류] 알 수 없는 현재 상태: ${currentStatus}`);
    }

    if (!allowed.includes(newStatus)) {
        const currentLabel = ORDER_STATUS_LABELS[currentStatus];
        const newLabel = ORDER_STATUS_LABELS[newStatus];
        throw new Error(
            `[상태 전환 거부] [${currentLabel}] → [${newLabel}] 전환은 허용되지 않습니다. ` +
            `허용 가능한 전환: ${allowed.map((s) => ORDER_STATUS_LABELS[s]).join(', ') || '없음 (최종 상태)'}`
        );
    }
}

/**
 * 해당 전환 시 재고 복원이 필요한지 확인합니다.
 */
export function needsInventoryRestore(newStatus: OrderStatus): boolean {
    return INVENTORY_RESTORE_STATUSES.includes(newStatus);
}

/**
 * 해당 상태가 최종 상태인지 확인합니다.
 */
export function isTerminalStatus(status: OrderStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
}
