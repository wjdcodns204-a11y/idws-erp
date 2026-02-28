// src/channels/musinsa.adapter.ts
// 무신사 파트너스 API 어댑터
// — API 인증키 직접 사용 (OAuth 아님)
// — 401/403 에러 세분화
// — 결제완료/주문확인 상태만 수집
// — CS(취소/반품/교환) 읽기 전용 조회

import type { IChannelAdapter, RawOrder, RawClaim, SalesData } from './types';

// ─── 무신사 API 에러 코드별 한글 메시지 ───
const ERROR_MESSAGES: Record<number, string> = {
    400: '[무신사] 요청 형식이 잘못되었습니다. 파라미터를 확인해 주세요.',
    401: '[무신사] API 인증키가 올바르지 않거나 만료되었습니다. 파트너센터에서 키를 재확인해 주세요.',
    403: '[무신사] 접근이 거부되었습니다. 가능한 원인:\n  1) 서버 IP가 화이트리스트에 등록되지 않았습니다\n  2) API 대행사 설정이 일치하지 않습니다\n  3) 서브 계정으로는 접근할 수 없습니다 (마스터 계정 필요)',
    404: '[무신사] 요청한 API 경로를 찾을 수 없습니다. Base URL을 확인해 주세요.',
    429: '[무신사] 요청 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    500: '[무신사] 무신사 서버 내부 오류입니다. 잠시 후 다시 시도해 주세요.',
    503: '[무신사] 무신사 서버가 점검 중입니다. 잠시 후 다시 시도해 주세요.',
};

// ─── 무신사 주문 상태 한글 ↔ 영문 매핑 ───
const ORDER_STATUS_MAP: Record<string, string> = {
    '결제완료': 'PAYMENT_COMPLETED',
    '주문확인': 'ORDER_CONFIRMED',
    '상품준비중': 'PREPARING',
    '배송준비중': 'PREPARING',
    '출고완료': 'SHIPPED',
    '배송중': 'IN_TRANSIT',
    '배송완료': 'DELIVERED',
    '구매확정': 'PURCHASE_CONFIRMED',
};

// 수집 대상 상태 (결제완료 또는 주문확인만)
const COLLECTIBLE_STATUSES = ['결제완료', '주문확인'];

export class MusinsaAdapter implements IChannelAdapter {
    readonly channelName = '무신사';
    private apiKey: string;
    private baseUrl: string;

    constructor(config: Record<string, string>) {
        // API 키는 환경변수에서 가져오거나 config에서 직접 받음
        this.apiKey = config.apiKey || process.env.MUSINSA_API_KEY || '';
        this.baseUrl = config.baseUrl || process.env.MUSINSA_API_BASE_URL || 'https://bizest.musinsa.com';

        if (!this.apiKey) {
            throw new Error('[무신사] API 인증키가 설정되지 않았습니다.\n설정 → 무신사 → API 키 입력이 필요합니다.');
        }
    }

    // ─── HTTP 요청 공통 메서드 ───
    // 모든 API 호출은 이 메서드를 통해 수행됨
    private async request<T>(
        path: string,
        method: 'GET' | 'POST' = 'GET',
        body?: Record<string, unknown>,
        params?: Record<string, string>
    ): Promise<T> {
        // URL 파라미터 조립
        const url = new URL(path, this.baseUrl);
        if (params) {
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        }

        const headers: Record<string, string> = {
            'MUSINSA-PARTNER-KEY': this.apiKey,  // 무신사 고유 인증 헤더
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const options: RequestInit = { method, headers };
        if (body && method === 'POST') {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url.toString(), {
                ...options,
                signal: AbortSignal.timeout(15000), // 15초 타임아웃
            });

            // ─── 에러 상태코드별 세분화 처리 ───
            if (!response.ok) {
                const statusCode = response.status;
                const errorMessage = ERROR_MESSAGES[statusCode]
                    || `[무신사] 알 수 없는 오류 (HTTP ${statusCode})`;

                // 응답 본문에 추가 정보가 있으면 포함
                let detail = '';
                try {
                    const errorBody = await response.text();
                    if (errorBody) detail = `\n상세: ${errorBody.substring(0, 200)}`;
                } catch { /* 무시 */ }

                throw new MusinsaApiError(statusCode, errorMessage + detail);
            }

            return await response.json() as T;
        } catch (error) {
            if (error instanceof MusinsaApiError) throw error;

            // 네트워크 오류 (타임아웃, DNS 등)
            if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) {
                throw new MusinsaApiError(
                    0,
                    `[무신사] 서버에 연결할 수 없습니다.\nBase URL (${this.baseUrl})을 확인하거나, 네트워크 상태를 점검해 주세요.`
                );
            }
            throw error;
        }
    }

    // ─── 인증 테스트 ───
    // 연결 테스트 버튼에서 호출 — API 키와 IP가 유효한지 확인
    async authenticate(): Promise<void> {
        try {
            // 간단한 API 호출로 인증 확인 (주문 1건 조회 시도)
            await this.request('/api/v1/orders', 'GET', undefined, {
                page: '1',
                size: '1',
            });
            console.log('[무신사] ✅ API 연결 테스트 성공');
        } catch (error) {
            if (error instanceof MusinsaApiError) {
                throw error; // 이미 세분화된 에러 메시지 포함
            }
            throw new Error('[무신사] 연결 테스트 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        }
    }

    // ─── 주문 수집 ───
    // 결제완료 또는 주문확인 상태인 건만 수집
    async fetchOrders(since: Date): Promise<RawOrder[]> {
        console.log(`[무신사] ${since.toISOString()} 이후 주문 수집 시작`);

        const allOrders: RawOrder[] = [];
        let page = 1;
        const pageSize = 50;
        let hasMore = true;

        while (hasMore) {
            try {
                // 무신사 API 호출 (결제완료/주문확인 상태만)
                const response = await this.request<MusinsaOrderResponse>(
                    '/api/v1/orders',
                    'GET',
                    undefined,
                    {
                        page: String(page),
                        size: String(pageSize),
                        startDate: formatDateForApi(since),
                        endDate: formatDateForApi(new Date()),
                        status: COLLECTIBLE_STATUSES.join(','),
                    }
                );

                if (!response.data || response.data.length === 0) {
                    hasMore = false;
                    break;
                }

                // 무신사 주문 → ERP RawOrder 형식으로 변환
                for (const order of response.data) {
                    allOrders.push(convertToRawOrder(order));
                }

                // 다음 페이지 확인
                if (response.data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } catch (error) {
                console.error(`[무신사] 주문 수집 ${page}페이지 오류:`, error);
                throw error;
            }
        }

        console.log(`[무신사] 주문 ${allOrders.length}건 수집 완료`);
        return allOrders;
    }

    // ─── CS(클레임) 조회 — 읽기 전용 ───
    // 취소/반품/교환은 조회만 가능, 처리는 파트너센터에서 직접
    async fetchClaims(since: Date): Promise<RawClaim[]> {
        console.log(`[무신사] ${since.toISOString()} 이후 CS 조회 시작`);

        const allClaims: RawClaim[] = [];
        let page = 1;
        const pageSize = 50;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.request<MusinsaClaimResponse>(
                    '/api/v1/claims',
                    'GET',
                    undefined,
                    {
                        page: String(page),
                        size: String(pageSize),
                        startDate: formatDateForApi(since),
                        endDate: formatDateForApi(new Date()),
                    }
                );

                if (!response.data || response.data.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const claim of response.data) {
                    allClaims.push(convertToRawClaim(claim));
                }

                if (response.data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } catch (error) {
                console.error(`[무신사] CS 조회 ${page}페이지 오류:`, error);
                throw error;
            }
        }

        console.log(`[무신사] CS ${allClaims.length}건 조회 완료`);
        return allClaims;
    }

    // ─── 매출 리포트 조회 ───
    async fetchSalesReport(from: Date, to: Date): Promise<SalesData> {
        console.log(`[무신사] ${from.toISOString()} ~ ${to.toISOString()} 매출 리포트 요청`);

        try {
            const response = await this.request<MusinsaSalesResponse>(
                '/api/v1/settlements',
                'GET',
                undefined,
                {
                    startDate: formatDateForApi(from),
                    endDate: formatDateForApi(to),
                }
            );

            return {
                channelName: this.channelName,
                periodStart: from,
                periodEnd: to,
                totalSales: response.data?.totalSales || 0,
                totalCommission: response.data?.totalCommission || 0,
                netAmount: response.data?.netAmount || 0,
                orderCount: response.data?.orderCount || 0,
            };
        } catch (error) {
            console.error('[무신사] 매출 리포트 조회 오류:', error);
            throw error;
        }
    }

    async handleWebhook(payload: unknown): Promise<void> {
        console.log('[무신사] Webhook 수신:', payload);
    }

    // ─── 상품 상태 조회 ───
    // 무신사 파트너 API에서 전체 상품의 판매 상태를 가져옴
    // 반환: { goodsNo: { status, goodsName, store } } 형태의 맵
    async fetchProductStatus(): Promise<MusinsaProductStatusResult[]> {
        console.log('[무신사] 상품 상태 조회 시작');

        const allProducts: MusinsaProductStatusResult[] = [];
        let page = 1;
        const pageSize = 100;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.request<MusinsaGoodsResponse>(
                    '/api/v1/goods',
                    'GET',
                    undefined,
                    {
                        page: String(page),
                        size: String(pageSize),
                    }
                );

                if (!response.data || response.data.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const goods of response.data) {
                    allProducts.push({
                        goodsNo: String(goods.goodsNo || ''),
                        goodsName: goods.goodsName || '',
                        styleCode: goods.styleCode || goods.brandStyleCode || '',
                        status: mapGoodsStatus(goods.saleStatus || goods.status || ''),
                        store: (goods.channel || goods.salesChannel || '').toLowerCase().includes('outlet') ? 'outlet' : 'normal',
                        sellingPrice: goods.sellingPrice || goods.price || 0,
                        tagPrice: goods.normalPrice || goods.tagPrice || 0,
                    });
                }

                if (response.data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } catch (error) {
                console.error(`[무신사] 상품 조회 ${page}페이지 오류:`, error);
                throw error;
            }
        }

        console.log(`[무신사] 상품 ${allProducts.length}건 상태 조회 완료`);
        return allProducts;
    }
}

// ─── 커스텀 에러 클래스 ───
// HTTP 상태코드와 한글 에러 메시지를 함께 전달
export class MusinsaApiError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'MusinsaApiError';
    }
}

// ─── 무신사 API 응답 타입 ───
interface MusinsaOrderResponse {
    data: MusinsaOrderData[];
    totalCount?: number;
}

interface MusinsaOrderData {
    orderId?: string;
    orderNumber?: string;
    buyerName?: string;
    buyerPhone?: string;
    receiverAddress?: string;
    receiverZipcode?: string;
    orderStatus?: string;
    orderDate?: string;
    totalPrice?: number;
    discountPrice?: number;
    shippingFee?: number;
    items?: MusinsaOrderItemData[];
}

interface MusinsaOrderItemData {
    goodsNo?: string;      // 품번코드
    optionNo?: string;     // 단품코드
    goodsName?: string;
    optionInfo?: string;   // 색상/사이즈
    quantity?: number;
    price?: number;
    discountPrice?: number;
}

interface MusinsaClaimResponse {
    data: MusinsaClaimData[];
}

interface MusinsaClaimData {
    claimNo?: string;
    orderId?: string;
    orderNumber?: string;
    claimType?: string;     // CANCEL / RETURN / EXCHANGE
    claimStatus?: string;
    claimReason?: string;
    buyerName?: string;
    claimPrice?: number;
    requestDate?: string;
    completeDate?: string;
    items?: MusinsaOrderItemData[];
}

interface MusinsaSalesResponse {
    data: {
        totalSales?: number;
        totalCommission?: number;
        netAmount?: number;
        orderCount?: number;
    };
}

// ─── 무신사 상품 조회 응답 타입 ───
interface MusinsaGoodsResponse {
    data: MusinsaGoodsData[];
    totalCount?: number;
}

interface MusinsaGoodsData {
    goodsNo?: string | number;
    goodsName?: string;
    styleCode?: string;
    brandStyleCode?: string;
    saleStatus?: string;
    status?: string;
    channel?: string;
    salesChannel?: string;
    sellingPrice?: number;
    price?: number;
    normalPrice?: number;
    tagPrice?: number;
}

// 무신사 상품 상태 결과 (외부에서 사용)
export interface MusinsaProductStatusResult {
    goodsNo: string;
    goodsName: string;
    styleCode: string;
    status: string;
    store: string;
    sellingPrice: number;
    tagPrice: number;
}

// ─── 무신사 상품 상태 매핑 ───
// API 응답의 saleStatus를 ERP의 상태값으로 변환
function mapGoodsStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
        // 영문 상태
        'ON_SALE': '판매중',
        'SOLD_OUT': '품절',
        'STOP': '판매중지',
        'REJECT': '검수반려',
        'WAITING': '검수중',
        'TEMPORARY': '임시저장',
        // 한글 상태 (일부 API에서 한글로 오는 경우)
        '판매중': '판매중',
        '품절': '품절',
        '판매중지': '판매중지',
        '검수반려': '검수반려',
        '검수중': '검수중',
        '삭제': '삭제',
    };
    return statusMap[apiStatus] || apiStatus || '알수없음';
}

// ─── 날짜 포맷 (YYYY-MM-DD) ───
function formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
}

// ─── 무신사 주문 → RawOrder 변환 ───
function convertToRawOrder(data: MusinsaOrderData): RawOrder {
    return {
        externalOrderId: data.orderId || data.orderNumber || '',
        orderNumber: data.orderNumber || '',
        customerName: data.buyerName || '',
        customerPhone: data.buyerPhone || '',
        customerAddress: data.receiverAddress || '',
        customerZipcode: data.receiverZipcode,
        totalAmount: data.totalPrice || 0,
        totalDiscount: data.discountPrice || 0,
        shippingFee: data.shippingFee || 0,
        orderedAt: data.orderDate ? new Date(data.orderDate) : new Date(),
        status: ORDER_STATUS_MAP[data.orderStatus || ''] || data.orderStatus || 'UNKNOWN',
        items: (data.items || []).map(item => ({
            externalProductId: item.goodsNo,
            externalSkuId: item.optionNo,
            productName: item.goodsName || '',
            optionInfo: item.optionInfo,
            sizeOption: item.optionInfo || '',
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            discountAmount: item.discountPrice || 0,
        })),
    };
}

// ─── 무신사 클레임 → RawClaim 변환 ───
function convertToRawClaim(data: MusinsaClaimData): RawClaim {
    const typeMap: Record<string, 'CANCEL' | 'RETURN' | 'EXCHANGE'> = {
        'CANCEL': 'CANCEL', '취소': 'CANCEL',
        'RETURN': 'RETURN', '반품': 'RETURN',
        'EXCHANGE': 'EXCHANGE', '교환': 'EXCHANGE',
    };

    return {
        claimId: data.claimNo || '',
        externalOrderId: data.orderId || '',
        orderNumber: data.orderNumber || '',
        claimType: typeMap[data.claimType || ''] || 'CANCEL',
        claimStatus: data.claimStatus || '',
        claimReason: data.claimReason || '',
        customerName: data.buyerName || '',
        claimAmount: data.claimPrice || 0,
        requestedAt: data.requestDate ? new Date(data.requestDate) : new Date(),
        processedAt: data.completeDate ? new Date(data.completeDate) : undefined,
        items: (data.items || []).map(item => ({
            externalProductId: item.goodsNo,
            externalSkuId: item.optionNo,
            productName: item.goodsName || '',
            optionInfo: item.optionInfo,
            sizeOption: item.optionInfo || '',
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            discountAmount: item.discountPrice || 0,
        })),
    };
}
