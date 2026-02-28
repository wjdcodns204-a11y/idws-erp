// 주문 관리 페이지 — 구글 시트 판매 데이터를 불러와 표시
// 기능: 구글 시트 불러오기, 검색, 채널/날짜 필터, 페이지네이션, 주문 상세 모달

'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';

// ─── 주문 상태 정의 ───
type OrderStatus =
    | 'PAYMENT_COMPLETED' | 'PREPARING' | 'SHIPPED' | 'IN_TRANSIT'
    | 'DELIVERED' | 'PURCHASE_CONFIRMED'
    | 'CANCEL_REQUESTED' | 'CANCELLED'
    | 'RETURN_REQUESTED' | 'RETURNED'
    | 'EXCHANGE_REQUESTED' | 'EXCHANGED';

// 주문 상태별 라벨과 색상
const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
    PAYMENT_COMPLETED: { label: '결제완료', color: '#6366f1', bg: '#eef2ff' },
    PREPARING: { label: '상품준비중', color: '#f59e0b', bg: '#fffbeb' },
    SHIPPED: { label: '출고완료', color: '#3b82f6', bg: '#eff6ff' },
    IN_TRANSIT: { label: '배송중', color: '#0ea5e9', bg: '#f0f9ff' },
    DELIVERED: { label: '배송완료', color: '#10b981', bg: '#ecfdf5' },
    PURCHASE_CONFIRMED: { label: '구매확정', color: '#059669', bg: '#d1fae5' },
    CANCEL_REQUESTED: { label: '취소요청', color: '#f97316', bg: '#fff7ed' },
    CANCELLED: { label: '취소완료', color: '#ef4444', bg: '#fef2f2' },
    RETURN_REQUESTED: { label: '반품요청', color: '#f97316', bg: '#fff7ed' },
    RETURNED: { label: '반품완료', color: '#ef4444', bg: '#fef2f2' },
    EXCHANGE_REQUESTED: { label: '교환요청', color: '#8b5cf6', bg: '#f5f3ff' },
    EXCHANGED: { label: '교환완료', color: '#7c3aed', bg: '#ede9fe' },
};

// ─── 채널 목록 ───
const CHANNELS = ['전체', '무신사', '29CM', 'LLUD', 'EE플레이스', '비하이브', '기타'];


// ─── 주문 상품 상세 ───
interface OrderItem {
    name: string;
    code: string;
    barcode: string;
    size: string;
    qty: number;
    price: number;
    costPrice: number;
    margin: number;
    discountRate: string;
}

// ─── 주문 데이터 타입 ───
interface Order {
    id: string;
    date: string;
    time: string;
    channel: string;
    customer: string;
    phone: string;
    address: string;
    items: OrderItem[];
    totalAmount: number;
    shippingFee: number;
    status: OrderStatus;
    weekLabel: string;
    trackingNumber?: string;
}

// ─── 헬퍼: 금액 표시 ───
function formatKRW(v: number): string {
    return v.toLocaleString('ko-KR') + '원';
}

// ─── 페이지당 표시 건수 옵션 ───
const PAGE_SIZE_OPTIONS = [30, 50, 100];

export default function OrdersPage() {
    // ─── 상태 관리 ───
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [collecting, setCollecting] = useState(false); // 이지어드민 수집 중 상태
    const [loadResult, setLoadResult] = useState<{ success: boolean; message: string } | null>(null);
    const [channelFilter, setChannelFilter] = useState('전체');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const excelFileRef = useRef<HTMLInputElement>(null);

    // ─── 페이지 처음 열릴 때: 서버 파일에서 저장된 데이터 자동 복원 ───
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/orders/saved');
                const data = await res.json();
                if (data.success && data.orders && data.orders.length > 0) {
                    setOrders(data.orders);
                    const savedTime = data.savedAt
                        ? new Date(data.savedAt).toLocaleString('ko-KR')
                        : '';
                    setLoadResult({
                        success: true,
                        message: `저장된 주문 ${data.orders.length.toLocaleString()}건 자동 복원됨${savedTime ? ` (${savedTime} 저장)` : ''}`,
                    });
                }
            } catch { /* 복원 실패 시 빈 상태 유지 */ }
        })();
    }, []);

    // ─── 구글 시트에서 데이터 불러오기 ───
    // import API가 데이터를 가져오면서 서버 파일에 자동 저장함
    const handleLoadFromSheet = useCallback(async () => {
        setLoading(true);
        setLoadResult(null);
        try {
            const res = await fetch('/api/orders/import-sheet');
            const data = await res.json();
            if (data.success) {
                setOrders(data.orders);
                setPage(1);
                setLoadResult({
                    success: true,
                    message: `구글 시트에서 ${data.totalOrders.toLocaleString()}건 주문 (총 ${data.totalRows.toLocaleString()}행) 불러오기 완료`,
                });
            } else {
                setLoadResult({ success: false, message: data.error || '불러오기 실패' });
            }
        } catch {
            setLoadResult({ success: false, message: '서버 연결 실패. 개발 서버가 실행 중인지 확인해 주세요.' });
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── 이지어드민에서 주문 수집 (수동) ───
    // 이지어드민에 로그인하여 최신 주문을 긁어오고, 기존 데이터와 병합 (중복 자동 제거)
    const handleCollectFromEzadmin = useCallback(async () => {
        setCollecting(true);
        setLoadResult(null);
        try {
            const res = await fetch('/api/ezadmin/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'orders' }),
            });
            const data = await res.json();
            if (data.success) {
                // 수집 후, 서버에 저장된 최신 데이터를 다시 불러와서 화면에 반영
                const savedRes = await fetch('/api/orders/saved');
                const savedData = await savedRes.json();
                if (savedData.success && savedData.orders) {
                    setOrders(savedData.orders);
                    setPage(1);
                }
                setLoadResult({
                    success: true,
                    message: `이지어드민 수집 완료 — ${data.message || data.stats?.newOrders + '건 수집'}`,
                });
            } else {
                setLoadResult({ success: false, message: data.error || '이지어드민 수집 실패' });
            }
        } catch {
            setLoadResult({ success: false, message: '이지어드민 연결 실패. 서버가 실행 중인지 확인해 주세요.' });
        } finally {
            setCollecting(false);
        }
    }, []);

    // ─── 이지어드민 엑셀 업로드 (기존 기능 유지) ───
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

                if (rows.length === 0) {
                    setLoadResult({ success: false, message: '엑셀에 데이터가 없습니다' });
                    return;
                }

                // 엑셀 데이터를 Order 형식으로 변환
                const parsed: Order[] = rows.map((row, idx) => {
                    const orderNo = row['주문번호'] || row['order_no'] || `IMP-${idx}`;
                    const productName = row['상품명'] || row['상품'] || '';
                    const productCode = row['상품코드'] || row['품번'] || '';
                    const qty = parseInt(row['수량'] || row['주문수량'] || '1') || 1;
                    const price = parseInt(String(row['판매금액'] || row['결제금액'] || row['금액'] || '0').replace(/,/g, '')) || 0;
                    const date = row['주문일'] || row['결제일'] || row['주문일시'] || new Date().toISOString().slice(0, 10);
                    const channel = row['판매채널'] || row['판매처'] || row['업체'] || '무신사';
                    const customer = row['고객명'] || row['수령인'] || row['주문자'] || '―';
                    const phone = row['연락처'] || row['전화번호'] || '';
                    const address = row['주소'] || row['배송주소'] || '';
                    const size = row['사이즈'] || row['옵션'] || row['옵션명'] || 'FREE';

                    return {
                        id: String(orderNo),
                        date: String(date).slice(0, 10),
                        time: '',
                        channel,
                        customer,
                        phone,
                        address,
                        items: [{ name: productName, code: productCode, barcode: '', size, qty, price, costPrice: 0, margin: 0, discountRate: '' }],
                        totalAmount: price * qty,
                        shippingFee: 0,
                        status: 'PURCHASE_CONFIRMED' as OrderStatus,
                        weekLabel: '',
                    };
                });

                const merged = [...parsed, ...orders];
                setOrders(merged);

                setPage(1);
                setLoadResult({ success: true, message: `엑셀에서 주문 ${parsed.length}건 추가 완료` });
            } catch (err) {
                setLoadResult({ success: false, message: `엑셀 파싱 실패: ${err}` });
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // ─── 필터 로직 ───
    const filtered = useMemo(() => {
        return orders.filter(order => {
            // 채널 필터
            if (channelFilter !== '전체' && order.channel !== channelFilter) return false;
            // 날짜 필터
            if (dateFrom && order.date < dateFrom) return false;
            if (dateTo && order.date > dateTo) return false;
            // 검색
            if (search) {
                const q = search.toLowerCase();
                if (!order.id.toLowerCase().includes(q)
                    && !order.customer.includes(q)
                    && !order.items.some(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.barcode.toLowerCase().includes(q))
                ) return false;
            }
            return true;
        });
    }, [orders, channelFilter, dateFrom, dateTo, search]);

    // ─── 페이지네이션 ───
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginatedOrders = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    // ─── 요약 통계 ───
    const stats = useMemo(() => {
        const totalSales = filtered.reduce((s, o) => s + o.totalAmount, 0);
        const totalQty = filtered.reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0);
        const totalMargin = filtered.reduce((s, o) => s + o.items.reduce((m, i) => m + i.margin, 0), 0);
        const totalCost = filtered.reduce((s, o) => s + o.items.reduce((c, i) => c + i.costPrice, 0), 0);

        // 채널별 통계
        const channelStats = new Map<string, { count: number; amount: number }>();
        filtered.forEach(o => {
            const existing = channelStats.get(o.channel) || { count: 0, amount: 0 };
            existing.count++;
            existing.amount += o.totalAmount;
            channelStats.set(o.channel, existing);
        });

        return { totalSales, totalQty, totalMargin, totalCost, channelStats };
    }, [filtered]);

    // ─── 고유 채널 목록 (데이터에서 자동 추출) ───
    const availableChannels = useMemo(() => {
        const channelSet = new Set(orders.map(o => o.channel));
        return ['전체', ...Array.from(channelSet).sort()];
    }, [orders]);

    return (
        <div className="space-y-5 animate-fade-in">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>주문 관리</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        구글 시트 판매 데이터 조회 · 검색 · 필터
                        {orders.length > 0 && <span className="ml-1 font-medium" style={{ color: 'var(--primary)' }}>({orders.length.toLocaleString()}건 로드됨)</span>}
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <input ref={excelFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                        onChange={handleExcelUpload} />
                    <button
                        onClick={() => excelFileRef.current?.click()}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        엑셀 업로드
                    </button>
                    <button
                        onClick={handleLoadFromSheet}
                        disabled={loading}
                        className={`text-xs px-4 py-1.5 rounded-lg font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 ${loading
                            ? 'bg-amber-50 text-amber-600 cursor-wait'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                            }`}>
                        {loading ? (
                            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        )}
                        {loading ? '불러오는 중...' : '📊 구글 시트 불러오기'}
                    </button>
                    <button
                        onClick={handleCollectFromEzadmin}
                        disabled={collecting || loading}
                        className={`text-xs px-4 py-1.5 rounded-lg font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 ${collecting
                            ? 'bg-amber-50 text-amber-600 cursor-wait'
                            : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
                            }`}>
                        {collecting ? (
                            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        )}
                        {collecting ? '수집 중...' : '🔄 이지어드민 수집'}
                    </button>
                </div>
            </div>

            {/* 로드 결과 알림 */}
            {loadResult && (
                <div className={`px-4 py-3 rounded-lg border flex items-center justify-between text-sm transition-all ${loadResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span>{loadResult.success ? '✅' : '❌'}</span>
                        <span className="font-medium">{loadResult.message}</span>
                    </div>
                    <button onClick={() => setLoadResult(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}

            {/* ─── 데이터가 없을 때 안내 ─── */}
            {orders.length === 0 && !loading && (
                <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="text-5xl mb-4">📊</div>
                    <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>판매 데이터를 불러와 주세요</h2>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                        위의 <strong>&ldquo;구글 시트 불러오기&rdquo;</strong> 버튼을 클릭하면, 구글 시트에 저장된 판매 데이터를 자동으로 가져와 이 페이지에 표시합니다.
                    </p>
                    <button
                        onClick={handleLoadFromSheet}
                        disabled={loading}
                        className="px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors inline-flex items-center gap-2 bg-indigo-500 text-white hover:bg-indigo-600 shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        구글 시트에서 불러오기
                    </button>
                </div>
            )}

            {/* ─── 데이터가 있을 때만 표시 ─── */}
            {orders.length > 0 && (
                <>
                    {/* ─── 요약 카드 ─── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: '총 주문', value: `${filtered.length.toLocaleString()}건`, amount: `총 ${stats.totalQty.toLocaleString()}개 판매`, color: '#6366f1', icon: '📦' },
                            { label: '총 매출', value: formatKRW(stats.totalSales), amount: `평균 ${filtered.length > 0 ? formatKRW(Math.round(stats.totalSales / filtered.length)) : '0원'}/건`, color: '#10b981', icon: '💰' },
                            { label: '총 마진', value: formatKRW(stats.totalMargin), amount: stats.totalSales > 0 ? `마진율 ${((stats.totalMargin / stats.totalSales) * 100).toFixed(1)}%` : '-', color: '#f59e0b', icon: '📈' },
                            { label: '총 원가', value: formatKRW(stats.totalCost), amount: stats.totalSales > 0 ? `원가율 ${((stats.totalCost / stats.totalSales) * 100).toFixed(1)}%` : '-', color: '#ef4444', icon: '🏭' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{s.label}</span>
                                    <span className="text-base">{s.icon}</span>
                                </div>
                                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{s.amount}</p>
                            </div>
                        ))}
                    </div>

                    {/* ─── 필터 바 ─── */}
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* 검색 */}
                        <div className="relative flex-1 min-w-[200px]">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text" placeholder="주문번호, 고객명, 상품명, 품번 검색..."
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg"
                                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
                            />
                        </div>
                        {/* 채널 필터 */}
                        <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1); }}
                            className="px-3 py-2 text-sm rounded-lg cursor-pointer"
                            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                            {availableChannels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                        </select>
                        {/* 날짜 필터 */}
                        <div className="flex items-center gap-1.5 text-sm">
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                className="px-2 py-2 rounded-lg text-xs"
                                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }} />
                            <span style={{ color: 'var(--text-tertiary)' }}>~</span>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                className="px-2 py-2 rounded-lg text-xs"
                                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </div>
                        {/* 초기화 */}
                        {(search || channelFilter !== '전체' || dateFrom || dateTo) && (
                            <button onClick={() => { setSearch(''); setChannelFilter('전체'); setDateFrom(''); setDateTo(''); setPage(1); }}
                                className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                                초기화
                            </button>
                        )}
                    </div>

                    {/* ─── 주문 테이블 ─── */}
                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr style={{ background: 'var(--background)', color: 'var(--text-tertiary)' }}>
                                        <th className="px-3 sm:px-4 py-3 text-left font-medium">주문번호</th>
                                        <th className="px-3 py-3 text-left font-medium">날짜</th>
                                        <th className="px-3 py-3 text-left font-medium">채널</th>
                                        <th className="px-3 py-3 text-left font-medium hidden md:table-cell">고객</th>
                                        <th className="px-3 py-3 text-left font-medium">상품</th>
                                        <th className="px-3 py-3 text-right font-medium">결제금액</th>
                                        <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">마진</th>
                                        <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">수량</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
                                                <p className="text-sm">검색 결과가 없습니다</p>
                                            </td>
                                        </tr>
                                    ) : paginatedOrders.map(order => {
                                        const totalMargin = order.items.reduce((s, i) => s + i.margin, 0);
                                        const totalQty = order.items.reduce((s, i) => s + i.qty, 0);
                                        return (
                                            <tr key={order.id + order.date}
                                                onClick={() => setSelectedOrder(order)}
                                                className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                <td className="px-3 sm:px-4 py-3 font-mono text-[10px] font-medium" style={{ color: 'var(--primary)' }}>
                                                    {order.id.length > 14 ? '...' + order.id.slice(-10) : order.id}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{order.date}</td>
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: order.channel === '무신사' ? '#eef2ff' : order.channel === '29CM' ? '#fef3c7' : '#f1f5f9',
                                                            color: order.channel === '무신사' ? '#4f46e5' : order.channel === '29CM' ? '#d97706' : '#475569',
                                                        }}>
                                                        {order.channel}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>{order.customer}</td>
                                                <td className="px-3 py-3 max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                                    {order.items[0].name}{order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}
                                                </td>
                                                <td className="px-3 py-3 text-right font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                                                    {formatKRW(order.totalAmount)}
                                                </td>
                                                <td className="px-3 py-3 text-right hidden lg:table-cell whitespace-nowrap" style={{ color: totalMargin > 0 ? '#059669' : '#ef4444' }}>
                                                    {totalMargin > 0 ? '+' : ''}{formatKRW(totalMargin)}
                                                </td>
                                                <td className="px-3 py-3 text-center hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>
                                                    {totalQty}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* ─── 하단: 결과 수 + 페이지네이션 ─── */}
                        <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                <span>총 {filtered.length.toLocaleString()}건 중 {((page - 1) * pageSize) + 1}~{Math.min(page * pageSize, filtered.length)}건</span>
                                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                    className="px-2 py-1 text-xs rounded border cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                                    {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}건씩</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(1)} disabled={page === 1}
                                    className="px-2 py-1 text-xs rounded border disabled:opacity-30 cursor-pointer" style={{ borderColor: 'var(--border)' }}>≪</button>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1 text-xs rounded border disabled:opacity-30 cursor-pointer" style={{ borderColor: 'var(--border)' }}>이전</button>
                                <span className="px-3 py-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    {page} / {totalPages}
                                </span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="px-3 py-1 text-xs rounded border disabled:opacity-30 cursor-pointer" style={{ borderColor: 'var(--border)' }}>다음</button>
                                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                                    className="px-2 py-1 text-xs rounded border disabled:opacity-30 cursor-pointer" style={{ borderColor: 'var(--border)' }}>≫</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ─── 주문 상세 모달 ─── */}
            {selectedOrder && (() => {
                const o = selectedOrder;
                const totalMargin = o.items.reduce((s, i) => s + i.margin, 0);
                const totalCost = o.items.reduce((s, i) => s + i.costPrice, 0);
                const totalQty = o.items.reduce((s, i) => s + i.qty, 0);
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
                        <div className="relative bg-white rounded-xl shadow-2xl border w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-in"
                            style={{ borderColor: 'var(--border)' }}>
                            {/* 모달 헤더 */}
                            <div className="sticky top-0 bg-white z-10 px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>주문 상세</h3>
                                    <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>{o.id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: o.channel === '무신사' ? '#eef2ff' : '#f1f5f9',
                                            color: o.channel === '무신사' ? '#4f46e5' : '#475569',
                                        }}>
                                        {o.channel}
                                    </span>
                                    <button onClick={() => setSelectedOrder(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                        style={{ color: 'var(--text-tertiary)' }}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* 주문 기본 정보 */}
                                <div className="rounded-lg p-3" style={{ background: 'var(--background)' }}>
                                    <p className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>주문 정보</p>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>주문일시</span><span style={{ color: 'var(--text-primary)' }}>{o.date} {o.time}</span></div>
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>판매 주차</span><span style={{ color: 'var(--text-primary)' }}>{o.weekLabel || '-'}</span></div>
                                    </div>
                                </div>

                                {/* 고객 정보 */}
                                <div className="rounded-lg p-3" style={{ background: 'var(--background)' }}>
                                    <p className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>고객 정보</p>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>이름</span><span style={{ color: 'var(--text-primary)' }}>{o.customer}</span></div>
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>연락처</span><span style={{ color: 'var(--text-primary)' }}>{o.phone}</span></div>
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>주소</span><span className="text-right max-w-[220px]" style={{ color: 'var(--text-primary)' }}>{o.address}</span></div>
                                    </div>
                                </div>

                                {/* 주문 상품 */}
                                <div>
                                    <p className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>주문 상품 ({o.items.length}건)</p>
                                    <div className="space-y-2">
                                        {o.items.map((item, i) => (
                                            <div key={i} className="p-2.5 rounded-lg" style={{ background: 'var(--background)' }}>
                                                <div className="flex items-start justify-between mb-1.5">
                                                    <div>
                                                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                                                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>{item.barcode || item.code} · {item.size} · {item.qty}개</p>
                                                    </div>
                                                    <span className="text-xs font-semibold whitespace-nowrap ml-2" style={{ color: 'var(--text-primary)' }}>{formatKRW(item.price)}</span>
                                                </div>
                                                {/* 수익 분석 */}
                                                {(item.costPrice > 0 || item.margin > 0) && (
                                                    <div className="flex gap-3 text-[10px] pt-1.5 mt-1.5" style={{ borderTop: '1px dashed var(--border-light)' }}>
                                                        {item.discountRate && <span style={{ color: '#ef4444' }}>할인 {item.discountRate}</span>}
                                                        <span style={{ color: 'var(--text-tertiary)' }}>원가 {formatKRW(item.costPrice)}</span>
                                                        <span style={{ color: '#059669' }}>마진 {formatKRW(item.margin)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {/* 합계 */}
                                    <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid var(--border-light)' }}>
                                        <div className="flex justify-between text-xs">
                                            <span style={{ color: 'var(--text-tertiary)' }}>총 수량</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{totalQty}개</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold">
                                            <span style={{ color: 'var(--text-primary)' }}>총 결제금액</span>
                                            <span style={{ color: 'var(--primary)' }}>{formatKRW(o.totalAmount)}</span>
                                        </div>
                                        {totalCost > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span style={{ color: 'var(--text-tertiary)' }}>총 원가</span>
                                                <span style={{ color: '#ef4444' }}>{formatKRW(totalCost)}</span>
                                            </div>
                                        )}
                                        {totalMargin > 0 && (
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span style={{ color: 'var(--text-tertiary)' }}>총 마진</span>
                                                <span style={{ color: '#059669' }}>+{formatKRW(totalMargin)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
