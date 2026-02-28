// src/channels/types.ts
// 외부 채널 연동 — 공통 인터페이스 정의

/**
 * 외부 플랫폼에서 수집한 원시 주문 데이터
 */
export interface RawOrder {
    externalOrderId: string; // 외부 플랫폼 주문 ID
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    customerZipcode?: string;
    items: RawOrderItem[];
    totalAmount: number;
    totalDiscount: number;
    shippingFee: number;
    orderedAt: Date;
    status: string; // 플랫폼별 상태값 (어댑터에서 매핑)
}

export interface RawOrderItem {
    externalSkuId?: string;  // 무신사 단품코드
    externalProductId?: string; // 무신사 품번코드
    barcode?: string;
    productName: string;
    optionInfo?: string;     // 옵션 정보 (색상/사이즈 등)
    sizeOption: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    // SKU 매핑 결과 (수집 후 매핑 서비스가 채움)
    mappedErpSku?: string;
    isMapped?: boolean;
}

/**
 * CS(클레임) 데이터 — 취소/반품/교환
 * 무신사는 '조회'만 가능, 처리는 파트너센터에서 직접
 */
export type ClaimType = 'CANCEL' | 'RETURN' | 'EXCHANGE';

export interface RawClaim {
    claimId: string;           // 클레임 고유 ID
    externalOrderId: string;   // 원 주문 ID
    orderNumber: string;
    claimType: ClaimType;      // 취소 / 반품 / 교환
    claimStatus: string;       // 플랫폼별 클레임 상태
    claimReason: string;       // 사유
    customerName: string;
    items: RawOrderItem[];
    claimAmount: number;       // 클레임 금액
    requestedAt: Date;         // 요청일
    processedAt?: Date;        // 처리 완료일 (있으면)
}

/**
 * SKU 매핑 — 무신사 품번/단품코드 ↔ ERP SKU
 * 무신사는 상품 자동 수집이 불가하므로 수동 매핑 필수
 */
export interface SkuMapping {
    musinsaProductCode: string;  // 무신사 품번코드
    musinsaOptionCode: string;   // 무신사 단품코드 (색상+사이즈)
    musinsaProductName: string;  // 무신사 상품명 (참고용)
    erpSku: string;              // ERP 내부 SKU 코드
    erpProductName?: string;     // ERP 상품명 (참고용)
    mappedAt: string;            // 매핑 등록일
    mappedBy: string;            // 매핑 등록자
}

/**
 * 매출/정산 리포트 데이터
 */
export interface SalesData {
    channelName: string;
    periodStart: Date;
    periodEnd: Date;
    totalSales: number;
    totalCommission: number;
    netAmount: number;
    orderCount: number;
    items?: SalesItem[];
}

export interface SalesItem {
    productCode: string;
    productName: string;
    quantity: number;
    salesAmount: number;
}

/**
 * 동기화 결과
 */
export interface SyncResult {
    success: boolean;
    totalProcessed: number;
    newOrders: number;
    updatedOrders: number;
    errors: string[];
}

/**
 * 모든 채널 어댑터가 구현해야 하는 공통 인터페이스
 */
export interface IChannelAdapter {
    /** 채널 이름 (로그 구분용) */
    readonly channelName: string;

    /** API 인증 (토큰 발급/갱신) */
    authenticate(): Promise<void>;

    /** 주문 목록 수집 (since 이후 변경된 주문) */
    fetchOrders(since: Date): Promise<RawOrder[]>;

    /** CS(클레임) 조회 — 읽기 전용 */
    fetchClaims?(since: Date): Promise<RawClaim[]>;

    /** 매출/정산 리포트 조회 */
    fetchSalesReport(from: Date, to: Date): Promise<SalesData>;

    /** Webhook 페이로드 처리 */
    handleWebhook(payload: unknown): Promise<void>;
}
