// 무신사 통합 관리 페이지
// 4개 탭: 📦 주문 수집, 🔄 CS 관리, 🏷️ SKU 매핑, ⚙️ 설정
// 요구사항 반영:
// - 취소 시 "파트너센터에서 수동 변경 필요" 경고
// - 반품/교환은 "읽기 전용 + 파트너센터 안내"
// - 미매핑 상품 노란 배지 알림

'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── 탭 정의 ───
const TABS = [
    { key: 'orders', label: '📦 주문 수집', desc: '엑셀 업로드로 주문 수집' },
    { key: 'claims', label: '🔄 CS 관리', desc: '취소/반품/교환 조회' },
    { key: 'skuMapping', label: '🏷️ SKU 매핑', desc: '품번-SKU 매핑 관리' },
    { key: 'settings', label: '⚙️ 설정', desc: 'API 키·연결 설정' },
];

// CS 타입 라벨/색상
const CLAIM_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    CANCEL: { label: '취소', color: '#ef4444', bg: '#fef2f2' },
    RETURN: { label: '반품', color: '#f59e0b', bg: '#fffbeb' },
    EXCHANGE: { label: '교환', color: '#8b5cf6', bg: '#f5f3ff' },
};

// 타입 정의
interface OrderItem {
    productName: string;
    externalProductId?: string;
    externalSkuId?: string;
    optionInfo?: string;
    sizeOption: string;
    quantity: number;
    unitPrice: number;
    mappedErpSku?: string;
    isMapped?: boolean;
}

interface CollectedOrder {
    externalOrderId: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    shippingFee: number;
    orderedAt: string;
    status: string;
    items: OrderItem[];
    hasUnmappedItems?: boolean;
    collectedAt?: string;
}

interface Claim {
    claimId: string;
    orderNumber: string;
    claimType: string;
    claimStatus: string;
    claimReason: string;
    customerName: string;
    claimAmount: number;
    requestedAt: string;
    readOnly?: boolean;
}

interface SkuMappingData {
    musinsaProductCode: string;
    musinsaOptionCode: string;
    musinsaProductName: string;
    erpSku: string;
    erpProductName?: string;
    mappedAt: string;
}

interface SettingsData {
    apiKey: string;
    baseUrl: string;
    hasApiKey: boolean;
    lastTestResult?: string;
    lastTestDate?: string;
    agency?: string;
}

// ─── 금액 포맷 ───
function formatKRW(v: number): string {
    return v.toLocaleString('ko-KR') + '원';
}

export default function MusinsaPage() {
    const [activeTab, setActiveTab] = useState('orders');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

    // ─── 주문 수집 상태 ───
    const [orders, setOrders] = useState<CollectedOrder[]>([]);
    const [orderStats, setOrderStats] = useState<{ total: number; unmapped: number }>({ total: 0, unmapped: 0 });

    // ─── CS 상태 ───
    const [claims, setClaims] = useState<Claim[]>([]);
    const [cancelWarning, setCancelWarning] = useState(false);

    // ─── SKU 매핑 상태 ───
    const [mappings, setMappings] = useState<SkuMappingData[]>([]);
    const [newMapping, setNewMapping] = useState({ musinsaProductCode: '', musinsaOptionCode: '', musinsaProductName: '', erpSku: '', erpProductName: '' });
    const [mappingSearch, setMappingSearch] = useState('');

    // ─── 설정 상태 ───
    const [settings, setSettings] = useState<SettingsData>({ apiKey: '', baseUrl: 'https://bizest.musinsa.com', hasApiKey: false });
    const [newApiKey, setNewApiKey] = useState('');
    const [newBaseUrl, setNewBaseUrl] = useState('https://bizest.musinsa.com');

    // ─── 메시지 자동 숨김 ───
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 6000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // ─── 데이터 로드 ───
    const loadOrders = useCallback(async () => {
        try {
            const res = await fetch('/api/musinsa/orders');
            const data = await res.json();
            if (data.success) {
                setOrders(data.data || []);
                const unmapped = (data.data || []).filter((o: CollectedOrder) => o.hasUnmappedItems).length;
                setOrderStats({ total: data.data?.length || 0, unmapped });
            }
        } catch { /* 무시 */ }
    }, []);

    const loadClaims = useCallback(async () => {
        try {
            const res = await fetch('/api/musinsa/claims');
            const data = await res.json();
            if (data.success) setClaims(data.data || []);
        } catch { /* 무시 */ }
    }, []);

    const loadMappings = useCallback(async () => {
        try {
            const res = await fetch('/api/musinsa/sku-mapping');
            const data = await res.json();
            if (data.success) setMappings(data.data || []);
        } catch { /* 무시 */ }
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const res = await fetch('/api/musinsa/settings');
            const data = await res.json();
            if (data.success) {
                setSettings(data.data);
                setNewBaseUrl(data.data.baseUrl || 'https://bizest.musinsa.com');
            }
        } catch { /* 무시 */ }
    }, []);

    // 탭 변경 시 데이터 로드
    useEffect(() => {
        if (activeTab === 'orders') loadOrders();
        if (activeTab === 'claims') loadClaims();
        if (activeTab === 'skuMapping') loadMappings();
        if (activeTab === 'settings') loadSettings();
    }, [activeTab, loadOrders, loadClaims, loadMappings, loadSettings]);

    // ─── 엑셀 파일 업로드로 주문 수집 ───
    const handleExcelUpload = async (file: File) => {
        setLoading(true);
        setMessage(null);
        try {
            // 엑셀 파일을 텍스트로 읽어서 CSV/TSV 파싱
            // (SheetJS 없이 브라우저에서 직접 처리)
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                setMessage({ type: 'error', text: '엑셀 파일에 데이터가 없습니다. (최소 헤더 + 1행)' });
                setLoading(false);
                return;
            }

            // 구분자 감지 (탭 또는 쉼표)
            const separator = lines[0].includes('\t') ? '\t' : ',';
            const headers = lines[0].split(separator).map(h => h.trim().replace(/^"/g, '').replace(/"$/g, ''));

            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(separator).map(v => v.trim().replace(/^"/g, '').replace(/"$/g, ''));
                const row: Record<string, string> = {};
                headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                rows.push(row);
            }

            // API로 전송
            const res = await fetch('/api/musinsa/orders/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            });
            const data = await res.json();

            if (data.success) {
                const unmappedMsg = data.stats?.unmappedItems > 0 ? ` (⚠️ 미매핑 상품 ${data.stats.unmappedItems}건 — SKU 매핑 탭에서 등록 필요)` : '';
                setMessage({ type: data.stats?.unmappedItems > 0 ? 'warning' : 'success', text: data.message + unmappedMsg });
                loadOrders();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (e) {
            setMessage({ type: 'error', text: '엑셀 업로드 실패: ' + (e instanceof Error ? e.message : '파일을 읽을 수 없습니다') });
        }
        setLoading(false);
    };

    // 파일 선택 핸들러
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleExcelUpload(file);
        e.target.value = ''; // 같은 파일 재선택 허용
    };

    // 드래그앤드롭 핸들러
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleExcelUpload(file);
    };

    // ─── CS 조회 실행 ───
    const syncClaims = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/musinsa/claims', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                loadClaims();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'CS 조회 실패: ' + (e instanceof Error ? e.message : '네트워크 오류') });
        }
        setLoading(false);
    };

    // ─── SKU 매핑 추가 ───
    const addMapping = async () => {
        if (!newMapping.musinsaProductCode || !newMapping.erpSku) {
            setMessage({ type: 'error', text: '무신사 품번코드와 ERP SKU는 필수입니다.' });
            return;
        }
        try {
            const res = await fetch('/api/musinsa/sku-mapping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newMapping) });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setNewMapping({ musinsaProductCode: '', musinsaOptionCode: '', musinsaProductName: '', erpSku: '', erpProductName: '' });
                loadMappings();
            }
        } catch {
            setMessage({ type: 'error', text: '매핑 등록 실패' });
        }
    };

    // ─── 설정 저장 ───
    const saveSettings = async () => {
        try {
            const body: Record<string, string> = { baseUrl: newBaseUrl };
            if (newApiKey) body.apiKey = newApiKey;
            const res = await fetch('/api/musinsa/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setNewApiKey('');
                loadSettings();
            }
        } catch {
            setMessage({ type: 'error', text: '설정 저장 실패' });
        }
    };

    // ─── 연결 테스트 ───
    const testConnection = async () => {
        setLoading(true);
        try {
            const body: Record<string, string> = { action: 'test', baseUrl: newBaseUrl };
            if (newApiKey) body.apiKey = newApiKey;
            const res = await fetch('/api/musinsa/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            setMessage({ type: data.success ? 'success' : 'error', text: data.success ? data.message : data.error });
            loadSettings();
        } catch {
            setMessage({ type: 'error', text: '연결 테스트 실패' });
        }
        setLoading(false);
    };

    // 매핑 검색 필터
    const filteredMappings = mappings.filter(m => {
        if (!mappingSearch) return true;
        const q = mappingSearch.toLowerCase();
        return m.musinsaProductCode.toLowerCase().includes(q) || m.musinsaProductName.toLowerCase().includes(q) || m.erpSku.toLowerCase().includes(q);
    });

    return (
        <div className="space-y-5 animate-fade-in">
            {/* 헤더 */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>무신사 연동 관리</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>파트너스 API · 주문 수집 · CS 관리 · SKU 매핑</p>
            </div>

            {/* 메시지 알림 */}
            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : message.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    <span>{message.type === 'success' ? '✅' : message.type === 'warning' ? '⚠️' : '❌'}</span>
                    <p className="whitespace-pre-line">{message.text}</p>
                    <button onClick={() => setMessage(null)} className="ml-auto text-xs opacity-50 hover:opacity-100 cursor-pointer">닫기</button>
                </div>
            )}

            {/* ─── 탭 네비게이션 ─── */}
            <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--background)' }}>
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ════════════════════════════════════════ */}
            {/* 📦 주문 수집 탭 */}
            {/* ════════════════════════════════════════ */}
            {activeTab === 'orders' && (
                <div className="space-y-4">
                    {/* 통계 카드 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>수집된 주문</p>
                            <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{orderStats.total}건</p>
                        </div>
                        <div className="rounded-xl p-4" style={{ background: orderStats.unmapped > 0 ? '#fffbeb' : 'var(--surface)', border: `1px solid ${orderStats.unmapped > 0 ? '#fbbf24' : 'var(--border)'}` }}>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>미매핑 상품 주문</p>
                            <p className="text-2xl font-bold" style={{ color: orderStats.unmapped > 0 ? '#f59e0b' : 'var(--text-primary)' }}>{orderStats.unmapped}건</p>
                            {orderStats.unmapped > 0 && <p className="text-[10px] mt-1 text-amber-600">SKU 매핑 탭에서 등록 필요</p>}
                        </div>
                    </div>

                    {/* 📂 엑셀 업로드 영역 */}
                    <div
                        className="rounded-xl p-8 text-center transition-all cursor-pointer"
                        style={{ background: 'var(--surface)', border: '2px dashed var(--border)' }}
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onDragEnter={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.background = '#eef2ff'; }}
                        onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                        onClick={() => document.getElementById('order-excel-input')?.click()}
                    >
                        <input id="order-excel-input" type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
                        <div className="text-3xl mb-2">📂</div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {loading ? '업로드 처리 중...' : '이지어드민/무신사 주문 엑셀 파일을 여기에 드래그하세요'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>또는 클릭하여 파일 선택 (CSV, TSV, TXT 지원)</p>
                    </div>

                    {/* 안내 */}
                    <div className="rounded-lg px-4 py-2.5 text-xs flex items-start gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                        ℹ️ <span>이지어드민 → <strong>주문배송관리</strong> → 엑셀 다운로드한 파일을 업로드하세요. 주문번호, 상품명, 금액 등을 자동으로 인식합니다.</span>
                    </div>

                    {/* 주문 목록 */}
                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr style={{ background: 'var(--background)', color: 'var(--text-tertiary)' }}>
                                        <th className="px-4 py-3 text-left font-medium">주문번호</th>
                                        <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">고객</th>
                                        <th className="px-3 py-3 text-left font-medium hidden md:table-cell">상품</th>
                                        <th className="px-3 py-3 text-right font-medium">금액</th>
                                        <th className="px-3 py-3 text-center font-medium">상태</th>
                                        <th className="px-3 py-3 text-center font-medium">매핑</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                                            {loading ? '업로드 중...' : '주문 데이터가 없습니다. 위에서 엑셀 파일을 업로드해 주세요.'}
                                        </td></tr>
                                    ) : orders.map(order => (
                                        <tr key={order.externalOrderId} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid var(--border-light)' }}>
                                            <td className="px-4 py-3 font-mono font-medium" style={{ color: 'var(--primary)' }}>{order.orderNumber || order.externalOrderId}</td>
                                            <td className="px-3 py-3 hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>{order.customerName}</td>
                                            <td className="px-3 py-3 hidden md:table-cell truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                                                {order.items[0]?.productName || '-'}{order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}
                                            </td>
                                            <td className="px-3 py-3 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{formatKRW(order.totalAmount)}</td>
                                            <td className="px-3 py-3 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{order.status}</span></td>
                                            <td className="px-3 py-3 text-center">
                                                {order.hasUnmappedItems
                                                    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⚠️ 미등록</span>
                                                    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">✅ 완료</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════ */}
            {/* 🔄 CS 관리 탭 */}
            {/* ════════════════════════════════════════ */}
            {activeTab === 'claims' && (
                <div className="space-y-4">
                    {/* ⚠️ 취소 역전송 불가 경고 */}
                    <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
                        <div className="flex items-start gap-2">
                            <span className="text-base">🚨</span>
                            <div>
                                <p className="font-bold">ERP에서의 취소 처리 시 주의사항</p>
                                <p className="mt-1 text-xs">ERP 내부에서 주문을 취소/폐기하더라도, 이 상태값이 <strong>무신사 파트너센터로 자동 역전송되지 않습니다.</strong></p>
                                <p className="mt-1 text-xs">반드시 <a href="https://partner.musinsa.com" target="_blank" rel="noopener" className="underline font-semibold">무신사 파트너센터</a>에 접속하여 실제 주문 상태를 수동으로 변경해 주세요.</p>
                            </div>
                        </div>
                    </div>

                    {/* ℹ️ 반품/교환 읽기 전용 안내 */}
                    <div className="rounded-lg px-4 py-2.5 text-xs flex items-start gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                        <span>ℹ️</span>
                        <span>반품/교환 주문 건은 API 연동 상 <strong>조회만 가능</strong>합니다. 처리는 <a href="https://partner.musinsa.com" target="_blank" rel="noopener" className="underline font-semibold">무신사 스토어 파트너센터</a>에서 직접 진행해 주세요.</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CS 목록 (최근 30일)</h3>
                        <button onClick={syncClaims} disabled={loading} className="px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer disabled:opacity-50 transition-all" style={{ background: '#6366f1' }}>
                            {loading ? '조회 중...' : '🔄 CS 데이터 조회'}
                        </button>
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr style={{ background: 'var(--background)', color: 'var(--text-tertiary)' }}>
                                        <th className="px-4 py-3 text-left font-medium">유형</th>
                                        <th className="px-3 py-3 text-left font-medium">주문번호</th>
                                        <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">고객</th>
                                        <th className="px-3 py-3 text-left font-medium hidden md:table-cell">사유</th>
                                        <th className="px-3 py-3 text-right font-medium">금액</th>
                                        <th className="px-3 py-3 text-center font-medium">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>CS 데이터가 없습니다.</td></tr>
                                    ) : claims.map(claim => {
                                        const typeConfig = CLAIM_TYPE_CONFIG[claim.claimType] || { label: claim.claimType, color: '#64748b', bg: '#f8fafc' };
                                        return (
                                            <tr key={claim.claimId} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}>{typeConfig.label}</span></td>
                                                <td className="px-3 py-3 font-mono" style={{ color: 'var(--primary)' }}>{claim.orderNumber}</td>
                                                <td className="px-3 py-3 hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>{claim.customerName}</td>
                                                <td className="px-3 py-3 hidden md:table-cell truncate max-w-[180px]" style={{ color: 'var(--text-tertiary)' }}>{claim.claimReason}</td>
                                                <td className="px-3 py-3 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{formatKRW(claim.claimAmount)}</td>
                                                <td className="px-3 py-3 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{claim.claimStatus}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 취소 교차검증 모달 (cancelWarning 상태에 의해 표시) */}
                    {cancelWarning && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCancelWarning(false)} />
                            <div className="relative bg-white rounded-xl p-6 shadow-2xl max-w-md animate-fade-in" style={{ border: '2px solid #ef4444' }}>
                                <div className="text-center">
                                    <span className="text-4xl">🚨</span>
                                    <h3 className="text-lg font-bold mt-2 text-red-700">취소 처리 경고</h3>
                                    <p className="text-sm mt-3 text-slate-600">ERP에서 주문을 취소해도 <strong className="text-red-600">무신사에는 자동 반영되지 않습니다.</strong></p>
                                    <p className="text-sm mt-2 text-slate-600">반드시 <strong>무신사 파트너센터</strong>에 접속하여 주문 상태를 직접 변경해 주세요.</p>
                                    <div className="flex gap-2 mt-5">
                                        <button onClick={() => setCancelWarning(false)} className="flex-1 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors">닫기</button>
                                        <a href="https://partner.musinsa.com" target="_blank" rel="noopener" className="flex-1 py-2 rounded-lg text-sm font-medium text-center text-white cursor-pointer transition-colors" style={{ background: '#ef4444' }}>파트너센터 열기 →</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════ */}
            {/* 🏷️ SKU 매핑 탭 */}
            {/* ════════════════════════════════════════ */}
            {activeTab === 'skuMapping' && (
                <div className="space-y-4">
                    {/* 안내 */}
                    <div className="rounded-lg px-4 py-2.5 text-xs flex items-start gap-2" style={{ background: '#fffbeb', border: '1px solid #fbbf24', color: '#92400e' }}>
                        <span>⚡</span>
                        <span>무신사 API는 상품 자동 수집 기능을 지원하지 않습니다. 주문 수집 시 상품을 인식하려면 아래에서 <strong>무신사 품번코드 → ERP SKU</strong>를 미리 매핑해야 합니다.</span>
                    </div>

                    {/* 신규 매핑 등록 */}
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>매핑 등록</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            <input type="text" placeholder="무신사 품번코드 *" value={newMapping.musinsaProductCode} onChange={e => setNewMapping(p => ({ ...p, musinsaProductCode: e.target.value }))}
                                className="px-3 py-2 text-xs rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                            <input type="text" placeholder="단품코드 (옵션)" value={newMapping.musinsaOptionCode} onChange={e => setNewMapping(p => ({ ...p, musinsaOptionCode: e.target.value }))}
                                className="px-3 py-2 text-xs rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                            <input type="text" placeholder="무신사 상품명" value={newMapping.musinsaProductName} onChange={e => setNewMapping(p => ({ ...p, musinsaProductName: e.target.value }))}
                                className="px-3 py-2 text-xs rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                            <input type="text" placeholder="ERP SKU *" value={newMapping.erpSku} onChange={e => setNewMapping(p => ({ ...p, erpSku: e.target.value }))}
                                className="px-3 py-2 text-xs rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                            <input type="text" placeholder="ERP 상품명" value={newMapping.erpProductName} onChange={e => setNewMapping(p => ({ ...p, erpProductName: e.target.value }))}
                                className="px-3 py-2 text-xs rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                            <button onClick={addMapping} className="px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer transition-all" style={{ background: '#6366f1' }}>+ 등록</button>
                        </div>
                    </div>

                    {/* 검색 + 카운트 */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-xs">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input type="text" placeholder="품번, 상품명, SKU 검색..." value={mappingSearch} onChange={e => setMappingSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>총 {mappings.length}개 매핑</span>
                    </div>

                    {/* 매핑 테이블 */}
                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr style={{ background: 'var(--background)', color: 'var(--text-tertiary)' }}>
                                        <th className="px-4 py-3 text-left font-medium">무신사 품번</th>
                                        <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">단품코드</th>
                                        <th className="px-3 py-3 text-left font-medium hidden md:table-cell">무신사 상품명</th>
                                        <th className="px-3 py-3 text-center font-medium">→</th>
                                        <th className="px-3 py-3 text-left font-medium">ERP SKU</th>
                                        <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">등록일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMappings.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>매핑 데이터가 없습니다. 위에서 등록하거나 엑셀을 업로드해 주세요.</td></tr>
                                    ) : filteredMappings.map(m => (
                                        <tr key={`${m.musinsaProductCode}_${m.musinsaOptionCode}`} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid var(--border-light)' }}>
                                            <td className="px-4 py-3 font-mono font-medium" style={{ color: 'var(--primary)' }}>{m.musinsaProductCode}</td>
                                            <td className="px-3 py-3 font-mono hidden sm:table-cell" style={{ color: 'var(--text-tertiary)' }}>{m.musinsaOptionCode || '-'}</td>
                                            <td className="px-3 py-3 truncate max-w-[180px] hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>{m.musinsaProductName || '-'}</td>
                                            <td className="px-3 py-3 text-center text-indigo-400">→</td>
                                            <td className="px-3 py-3 font-mono font-semibold" style={{ color: '#059669' }}>{m.erpSku}</td>
                                            <td className="px-3 py-3 hidden sm:table-cell" style={{ color: 'var(--text-tertiary)' }}>{m.mappedAt}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════ */}
            {/* ⚙️ 설정 탭 */}
            {/* ════════════════════════════════════════ */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    {/* API 키 설정 */}
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>API 인증 설정</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>API 인증키</label>
                                <div className="flex gap-2">
                                    <input type="password" placeholder={settings.hasApiKey ? '현재 키: ' + settings.apiKey : '무신사 파트너센터에서 발급받은 API 키 입력'}
                                        value={newApiKey} onChange={e => setNewApiKey(e.target.value)}
                                        className="flex-1 px-3 py-2 text-xs rounded-lg font-mono" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                                </div>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>파트너센터 → My menu → 업체정보 → API 연동 정보에서 확인</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>API Base URL</label>
                                <input type="text" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg font-mono" style={{ border: '1px solid var(--border)', background: 'var(--background)' }} />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>기본값: https://bizest.musinsa.com (필요시 변경)</p>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={saveSettings} className="px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer transition-all" style={{ background: '#6366f1' }}>💾 설정 저장</button>
                                <button onClick={testConnection} disabled={loading} className="px-4 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all disabled:opacity-50" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                                    {loading ? '테스트 중...' : '🔌 연결 테스트'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 연결 상태 */}
                    {settings.lastTestResult && (
                        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>마지막 연결 테스트</h3>
                            <p className="text-sm whitespace-pre-line" style={{ color: settings.lastTestResult.startsWith('✅') ? '#059669' : '#ef4444' }}>{settings.lastTestResult}</p>
                            {settings.lastTestDate && <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{new Date(settings.lastTestDate).toLocaleString('ko-KR')}</p>}
                        </div>
                    )}

                    {/* IP 화이트리스팅 안내 */}
                    <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#fffbeb', border: '1px solid #fbbf24', color: '#92400e' }}>
                        <p className="font-bold">⚠️ IP 화이트리스팅 안내</p>
                        <p className="mt-1">무신사는 등록된 고정 서버 IP만 API 접근이 가능합니다. 403 에러가 발생하면 무신사 파트너센터에서 현재 서버의 IP를 등록해 주세요.</p>
                    </div>

                    {/* 대행사 설정 안내 */}
                    <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#f8fafc', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <p className="font-bold">📌 API 대행사(Agency) 안내</p>
                        <p className="mt-1">무신사는 보안상 단 <strong>하나</strong>의 API 대행사만 지정할 수 있습니다. 다른 솔루션과 동시에 사용하면 데이터 충돌이 발생할 수 있으니 주의해 주세요.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
