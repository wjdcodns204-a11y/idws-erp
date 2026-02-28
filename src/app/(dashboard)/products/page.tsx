'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';

// ─── 상수 ───

const STATUS_TABS = [
    { key: '', label: '전체' },
    { key: '판매중', label: '판매중' },
    { key: '품절', label: '품절' },
    { key: '판매중지', label: '판매중지' },
    { key: '검수반려', label: '검수반려' },
    { key: '검수중', label: '검수중' },
    { key: '임시저장', label: '임시저장' },
    { key: 'OUTLET', label: '아울렛' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    '판매중': { label: '판매중', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    '품절': { label: '품절', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    '판매중지': { label: '판매중지', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    '검수반려': { label: '검수반려', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    '검수중': { label: '검수중', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    '임시저장': { label: '임시저장', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
    '삭제': { label: '삭제', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
};

const IMAGE_WIDTH = 1500;
const IMAGE_HEIGHT = 1800;
const THUMB_SIZE = 52;
const ITEMS_PER_PAGE = 20;

// ─── 타입 ───

interface SizeStockItem {
    size: string;
    stock: number;
    defective: number;
    available: number;
}

interface MusinsaProduct {
    musinsaCode: string;
    brand: string;
    categoryL: string;
    categoryM: string;
    categoryS: string;
    styleCode: string;
    imageUrl: string;
    name: string;
    status: string;
    tagPrice: number;
    sellingPrice: number;
    stock: number;
    availableStock: number;
    costPrice: number;
    commissionRate: number;
    discountRate: number;
    store: string;
    registeredAt: string;
    origin: string;
    sizeStock?: SizeStockItem[];
}

// ─── 유틸리티 ───

function formatPrice(price: number) {
    return price.toLocaleString('ko-KR') + '원';
}

// 판매 통계 타입 (API에서 받아오는 실제 주문 데이터 기반)
interface ProductSalesStats {
    totalQty: number;
    weeklyAvg: number;
    orderCount: number;
    totalAmount: number;
    firstDate: string;
    lastDate: string;
}

function StatusBadge({ status, isOutlet }: { status: string; isOutlet?: boolean }) {
    const c = STATUS_CONFIG[status] || STATUS_CONFIG['삭제'];
    return (
        <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {c.label}
            </span>
            {isOutlet && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                    아울렛
                </span>
            )}
        </div>
    );
}

function ProductThumbnail({ name }: { name: string; imageUrl: string }) {
    const thumbH = Math.round(THUMB_SIZE * (IMAGE_HEIGHT / IMAGE_WIDTH));
    // 공유 드라이브 제품컷(보정) → 제품컷(원본) 순서로 이미지 불러옴
    const localSrc = `/api/products/images?name=${encodeURIComponent(name)}`;

    return (
        <img
            src={localSrc}
            alt={name}
            className="rounded-lg border border-slate-200 object-cover bg-slate-50"
            style={{ width: THUMB_SIZE, height: thumbH }}
            onError={(e) => {
                // 이미지가 없으면 아무것도 표시하지 않음
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
}

// ─── 카테고리 추출 (OUTER / TOP / BOTTOM / ACC) ───
const CATEGORY_MAP: Record<string, string> = {
    '아우터': 'OUTER', '자켓': 'OUTER', '코트': 'OUTER', '패딩': 'OUTER',
    '점퍼': 'OUTER', '블루종': 'OUTER', '가디건': 'OUTER', '무스탕': 'OUTER',
    '플리스': 'OUTER', '야상': 'OUTER', '바람막이': 'OUTER', '조끼': 'OUTER',
    '상의': 'TOP', '티셔츠': 'TOP', '셔츠': 'TOP', '블라우스': 'TOP',
    '니트': 'TOP', '니트/스웨터': 'TOP', '스웨터': 'TOP',
    '맨투맨/스웨트셔츠': 'TOP', '맨투맨': 'TOP', '후드': 'TOP',
    '후드 티셔츠': 'TOP', '긴소매 티셔츠': 'TOP', '반소매 티셔츠': 'TOP',
    '피케/카라 티셔츠': 'TOP', '민소매 티셔츠': 'TOP', '스웨트셔츠': 'TOP',
    '하의': 'BOTTOM', '바지': 'BOTTOM', '팬츠': 'BOTTOM', '데님': 'BOTTOM',
    '데님 팬츠': 'BOTTOM', '숏팬츠': 'BOTTOM', '스커트': 'BOTTOM',
    '코튼 팬츠': 'BOTTOM', '트레이닝/조거 팬츠': 'BOTTOM', '레깅스': 'BOTTOM',
    '슈트 팬츠/슬랙스': 'BOTTOM', '점프 슈트/오버올': 'BOTTOM',
    '액세서리': 'ACC', '가방': 'ACC', '모자': 'ACC', '양말': 'ACC',
    '신발': 'ACC', '주얼리': 'ACC', '벨트': 'ACC', '시계': 'ACC',
    '지갑': 'ACC', '반지': 'ACC', '목걸이': 'ACC', '귀걸이': 'ACC',
    '팔찌': 'ACC', '머플러': 'ACC', '스카프': 'ACC', '장갑': 'ACC',
    '선글라스': 'ACC', '안경': 'ACC', '헤어 액세서리': 'ACC', '키링': 'ACC',
};

function extractCategory(catM: string): string {
    const parts = catM.split('>').map(s => s.trim());
    for (let i = 1; i < parts.length; i++) {
        if (CATEGORY_MAP[parts[i]]) return CATEGORY_MAP[parts[i]];
    }
    const large = (parts[0] || '').toLowerCase();
    if (large.includes('outer') || large.includes('상의')) return 'OUTER';
    if (large.includes('top')) return 'TOP';
    if (large.includes('bottom') || large.includes('하의')) return 'BOTTOM';
    if (large.includes('acc') || large.includes('잡화')) return 'ACC';
    return 'ACC';
}

// ─── 시즌 추출 ───
function extractSeason(code: string): string {
    if (code.startsWith('I')) {
        const yr = code.substring(1, 3);
        const sn = code.substring(3, 5);
        return `${yr}${sn}`;
    }
    if (code.startsWith('23F')) return '23FW';
    if (code.startsWith('QIDW')) return 'Legacy';
    if (code.startsWith('Z')) return 'Z-기타';
    return '기타';
}

// ─── 메인 페이지 ───

export default function ProductsPage() {
    const [products, setProducts] = useState<MusinsaProduct[]>([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('');
    const [filterSeason, setFilterSeason] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    interface CostLog { styleCode: string; oldValue: number; newValue: number; changedAt: string; }
    const [costPriceLog, setCostPriceLog] = useState<CostLog[]>([]);

    const isAdmin = true;

    const [costLogModal, setCostLogModal] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<{ url: string; name: string; styleCode: string } | null>(null);

    interface EditDraft {
        tagPrice: number;
        sellingPrice: number;
        costPrice: number;
        categoryM: string;
        styleCode: string;
    }
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

    const syncFileRef = useRef<HTMLInputElement>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

    // 이지어드민 재고 동기화 상태
    const [ezSyncing, setEzSyncing] = useState(false);

    // 상품 상태 동기화 (무신사 파트너 API)
    const [statusSyncing, setStatusSyncing] = useState(false);

    // 정렬 및 추가 필터
    const [sortKey, setSortKey] = useState<'tagPrice' | 'stock' | ''>('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [filterStock, setFilterStock] = useState<'' | 'inStock' | 'outOfStock'>('');

    const handleSort = (key: 'tagPrice' | 'stock') => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const startEdit = (uid: number) => {
        const target = filtered[uid];
        if (!target) return;
        setEditingIdx(uid);
        setEditDraft({
            tagPrice: target.tagPrice,
            sellingPrice: target.sellingPrice,
            costPrice: target.costPrice,
            categoryM: extractCategory(target.categoryM),
            styleCode: target.styleCode,
        });
    };

    const cancelEdit = () => {
        setEditingIdx(null);
        setEditDraft(null);
    };

    const saveEdit = (uid: number) => {
        if (!editDraft) return;
        setProducts(prev => {
            const updated = [...prev];
            const target = filtered[uid];
            if (!target) return prev;
            const realIdx = updated.findIndex(p => p === target);
            if (realIdx >= 0) {
                const old = updated[realIdx];
                if (old.costPrice !== editDraft.costPrice && old.costPrice > 0) {
                    const now = new Date();
                    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                    setCostPriceLog(logs => [{ styleCode: old.styleCode, oldValue: old.costPrice, newValue: editDraft.costPrice, changedAt: timeStr }, ...logs]);
                }
                updated[realIdx] = {
                    ...old,
                    tagPrice: editDraft.tagPrice,
                    sellingPrice: editDraft.sellingPrice,
                    costPrice: editDraft.costPrice,
                    categoryM: editDraft.categoryM,
                    styleCode: editDraft.styleCode,
                };
            }
            return updated;
        });
        setEditingIdx(null);
        setEditDraft(null);
    };

    const loadProducts = useCallback(() => {
        fetch('/data/musinsa-products.json?t=' + Date.now())
            .then(res => res.json())
            .then((data: MusinsaProduct[]) => {
                setProducts(data.filter(p => p.status !== '삭제'));
                setLoading(false);
            })
            .catch(() => {
                setProducts([]);
                setLoading(false);
            });
    }, []);

    // 판매 통계 (실제 주문 데이터 기반)
    const [salesStats, setSalesStats] = useState<Record<string, ProductSalesStats>>({});

    useEffect(() => {
        loadProducts();
        // 판매 통계도 함께 불러오기
        fetch('/api/products/sales-stats')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.stats) setSalesStats(data.stats);
            })
            .catch(() => { /* 판매 통계 로드 실패 무시 */ });
    }, [loadProducts]);

    const handleSync = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSyncing(true);
        setSyncResult(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

            if (rows.length === 0) {
                setSyncResult({ success: false, message: '엑셀에 데이터가 없습니다.' });
                setSyncing(false);
                return;
            }

            const res = await fetch('/api/products/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            });

            const result = await res.json();

            if (res.ok) {
                setSyncResult({ success: true, message: result.message });
                loadProducts();
            } else {
                setSyncResult({ success: false, message: result.error || '동기화 실패' });
            }
        } catch {
            setSyncResult({ success: false, message: '엑셀 파일을 읽을 수 없습니다.' });
        } finally {
            setSyncing(false);
            if (syncFileRef.current) syncFileRef.current.value = '';
        }
    }, [loadProducts]);

    // 이지어드민 재고 동기화 핸들러
    const handleEzadminSync = useCallback(async () => {
        setEzSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/ezadmin/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'stock' }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                setSyncResult({ success: true, message: result.message || '이지어드민 재고 동기화 완료' });
                loadProducts();
            } else {
                setSyncResult({ success: false, message: result.error || '이지어드민 동기화 실패' });
            }
        } catch {
            setSyncResult({ success: false, message: '이지어드민 연결에 실패했습니다.' });
        } finally {
            setEzSyncing(false);
        }
    }, [loadProducts]);

    // 상품 상태 수동 동기화 (이지어드민 — OTP 불필요)
    const handleStatusSync = useCallback(async () => {
        setStatusSyncing(true);
        setSyncResult(null);

        try {
            const res = await fetch('/api/products/sync-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const result = await res.json();

            if (res.ok && result.success) {
                setSyncResult({ success: true, message: `[이지어드민] ${result.message}` });
                loadProducts();
            } else {
                setSyncResult({ success: false, message: result.error || '동기화 실패' });
            }
        } catch {
            setSyncResult({ success: false, message: '서버 연결에 실패했습니다.' });
        } finally {
            setStatusSyncing(false);
        }
    }, [loadProducts]);

    const seasons = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => set.add(extractSeason(p.styleCode)));
        return [...set].sort().reverse();
    }, [products]);

    const categories = ['OUTER', 'TOP', 'BOTTOM', 'ACC'];

    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = { '': products.length };
        products.forEach(p => {
            counts[p.status] = (counts[p.status] || 0) + 1;
            if (p.store === 'outlet') counts['OUTLET'] = (counts['OUTLET'] || 0) + 1;
        });
        return counts;
    }, [products]);

    const filtered = useMemo(() => {
        let result = products.filter(p => {
            if (search) {
                const q = search.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !p.styleCode.toLowerCase().includes(q) && !p.musinsaCode.includes(q)) return false;
            }
            if (activeTab === 'OUTLET') {
                if (p.store !== 'outlet') return false;
            } else if (activeTab && p.status !== activeTab) return false;
            if (filterSeason && extractSeason(p.styleCode) !== filterSeason) return false;
            if (filterCategory && extractCategory(p.categoryM) !== filterCategory) return false;
            // 재고 필터
            if (filterStock === 'inStock' && (p.stock || 0) <= 0) return false;
            if (filterStock === 'outOfStock' && (p.stock || 0) > 0) return false;
            return true;
        });
        // 정렬
        if (sortKey) {
            result = [...result].sort((a, b) => {
                const va = sortKey === 'tagPrice' ? (a.tagPrice || 0) : (a.stock || 0);
                const vb = sortKey === 'tagPrice' ? (b.tagPrice || 0) : (b.stock || 0);
                return sortDir === 'asc' ? va - vb : vb - va;
            });
        } else {
            // 기본 정렬: 최근 시즌 상품이 먼저 표시됨
            // 26SS(최신) → 25FW → 25SS → 24FW → ... → Legacy(가장 오래됨)
            const seasonOrder = (code: string): number => {
                const s = extractSeason(code);
                // "26SS" → year=26, season=SS → 26*2 + 0 = 52
                // "25FW" → year=25, season=FW → 25*2 + 1 = 51
                // "25SS" → year=25, season=SS → 25*2 + 0 = 50
                const match = s.match(/^(\d{2})(SS|FW)$/);
                if (match) {
                    const yr = parseInt(match[1]);
                    const isFW = match[2] === 'FW' ? 1 : 0;
                    return yr * 2 + isFW;
                }
                return -1; // Legacy, 기타 → 맨 뒤
            };
            result = [...result].sort((a, b) => {
                const oa = seasonOrder(a.styleCode);
                const ob = seasonOrder(b.styleCode);
                if (oa !== ob) return ob - oa; // 높은 숫자 = 최근 시즌 = 먼저
                return b.styleCode.localeCompare(a.styleCode);
            });
        }
        return result;
    }, [products, search, activeTab, filterSeason, filterCategory, filterStock, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paged = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const allSelected = paged.length > 0 && paged.every(p => selectedCodes.has(p.musinsaCode));
    const toggleAll = () => {
        if (allSelected) setSelectedCodes(new Set());
        else setSelectedCodes(new Set(paged.map(p => p.musinsaCode)));
    };
    const toggleOne = (code: string) => {
        const next = new Set(selectedCodes);
        next.has(code) ? next.delete(code) : next.add(code);
        setSelectedCodes(next);
    };

    useEffect(() => { setCurrentPage(1); }, [search, activeTab, filterSeason, filterCategory, filterStock, sortKey, sortDir]);
    useEffect(() => { if (expandedIdx === null) cancelEdit(); }, [expandedIdx]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-0 animate-fade-in">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        총 {products.length}개 상품 · 필터 결과 {filtered.length}개
                    </p>
                </div>
                <div className="flex gap-2">
                    <input
                        ref={syncFileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleSync}
                    />
                    <button
                        onClick={() => syncFileRef.current?.click()}
                        disabled={syncing}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${syncing
                            ? 'border-amber-300 bg-amber-50 text-amber-600 cursor-wait'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}>
                        {syncing ? (
                            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        )}
                        {syncing ? '동기화 중...' : '무신사 동기화'}
                    </button>
                    <button
                        onClick={handleEzadminSync}
                        disabled={ezSyncing}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${ezSyncing
                            ? 'border-amber-300 bg-amber-50 text-amber-600 cursor-wait'
                            : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}>
                        {ezSyncing ? (
                            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        )}
                        {ezSyncing ? '동기화 중...' : '이지어드민 재고'}
                    </button>
                    <button
                        onClick={handleStatusSync}
                        disabled={statusSyncing}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${statusSyncing
                            ? 'border-amber-300 bg-amber-50 text-amber-600 cursor-wait'
                            : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                            }`}>
                        {statusSyncing ? (
                            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        )}
                        {statusSyncing ? '동기화 중...' : '상태 동기화'}
                    </button>
                    <Link href="/products/import"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        엑셀 대량 등록
                    </Link>
                    <Link href="/products/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-colors"
                        style={{ background: 'var(--primary)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        상품 등록
                    </Link>
                </div>
            </div>

            {/* 동기화 결과 알림 */}
            {syncResult && (
                <div className={`mb-4 px-4 py-3 rounded-lg border flex items-center justify-between text-sm transition-all ${syncResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    <div className="flex items-center gap-2">
                        {syncResult.success ? (
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="font-medium">{syncResult.message}</span>
                    </div>
                    <button
                        onClick={() => setSyncResult(null)}
                        className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* 상태 탭 */}
            <div className="border-b border-slate-200 mb-4">
                <div className="flex gap-0">
                    {STATUS_TABS.map(tab => (
                        <button key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setSelectedCodes(new Set()); }}
                            className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:text-slate-700'
                                }`}>
                            {tab.label}
                            <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                                {tabCounts[tab.key] || 0}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 필터 바 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[240px]">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" placeholder="상품명, 품번, 상품코드 검색..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                    </div>

                    <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)}
                        className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[110px]">
                        <option value="">전체 시즌</option>
                        {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                        className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[120px]">
                        <option value="">전체 카테고리</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select value={filterStock} onChange={e => setFilterStock(e.target.value as '' | 'inStock' | 'outOfStock')}
                        className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[110px]">
                        <option value="">전체 재고</option>
                        <option value="inStock">재고 있음</option>
                        <option value="outOfStock">재고 없음</option>
                    </select>

                    <select value={sortKey ? `${sortKey}-${sortDir}` : ''}
                        onChange={e => {
                            const v = e.target.value;
                            if (!v) { setSortKey(''); return; }
                            const [k, d] = v.split('-');
                            setSortKey(k as 'tagPrice' | 'stock');
                            setSortDir(d as 'asc' | 'desc');
                        }}
                        className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[130px]">
                        <option value="">기본 정렬</option>
                        <option value="tagPrice-desc">정상가 높은순</option>
                        <option value="tagPrice-asc">정상가 낮은순</option>
                        <option value="stock-desc">재고 많은순</option>
                        <option value="stock-asc">재고 적은순</option>
                    </select>

                    {(search || filterSeason || filterCategory || filterStock || sortKey) && (
                        <button onClick={() => { setSearch(''); setFilterSeason(''); setFilterCategory(''); setFilterStock(''); setSortKey(''); }}
                            className="px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            초기화
                        </button>
                    )}
                </div>
            </div>

            {/* 일괄 작업 */}
            {selectedCodes.size > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between animate-fade-in">
                    <span className="text-sm font-medium text-indigo-700">{selectedCodes.size}개 상품 선택됨</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">상태 변경</button>
                        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">엑셀 내보내기</button>
                        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100">삭제</button>
                    </div>
                </div>
            )}

            {/* 상품 테이블 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th className="py-3 px-3 w-10">
                                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                </th>
                                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{ minWidth: 360 }}>상품정보</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">시즌</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">카테고리</th>
                                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                    onClick={() => handleSort('tagPrice')}>
                                    정상가 {sortKey === 'tagPrice' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                    onClick={() => handleSort('stock')}>
                                    현재고 {sortKey === 'stock' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">주평균판매</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">예상소진일</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">급증</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paged.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-slate-400">
                                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        <p className="text-sm font-medium">검색 결과가 없습니다</p>
                                    </td>
                                </tr>
                            ) : (
                                paged.map((product, idx) => {
                                    const uid = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                                    const isExpanded = expandedIdx === uid;
                                    return (
                                        <React.Fragment key={uid}>
                                            <tr className={`group transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                                                <td className="py-3 px-3">
                                                    <input type="checkbox" checked={selectedCodes.has(product.musinsaCode)}
                                                        onChange={() => toggleOne(product.musinsaCode)}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="cursor-pointer flex-shrink-0"
                                                            onClick={() => product.imageUrl && setImagePreview({ url: product.imageUrl, name: product.name, styleCode: product.styleCode })}>
                                                            <ProductThumbnail name={product.name} imageUrl={product.imageUrl} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-slate-900 truncate max-w-[280px]">{product.name}</span>
                                                                {product.store === 'outlet' && (
                                                                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">아울렛</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="font-mono text-xs text-indigo-600 font-medium">{product.styleCode}</span>
                                                                <button onClick={() => setExpandedIdx(isExpanded ? null : uid)}>
                                                                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                                        {extractSeason(product.styleCode)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center text-xs text-slate-600">
                                                    {extractCategory(product.categoryM)}
                                                </td>
                                                <td className="py-3 px-3 text-right text-sm text-slate-900">
                                                    {formatPrice(product.tagPrice)}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`text-sm font-medium ${product.availableStock === 0 ? 'text-red-500' : product.availableStock < 10 ? 'text-orange-500' : 'text-slate-700'}`}>
                                                            {product.availableStock.toLocaleString()}
                                                        </span>
                                                        {product.sizeStock && product.sizeStock.length > 0 && (
                                                            <div className="flex gap-0.5 flex-wrap justify-end">
                                                                {product.sizeStock.map((ss) => (
                                                                    <span key={ss.size}
                                                                        className={`inline-block px-1 py-px rounded text-[9px] font-mono leading-tight ${ss.available === 0 ? 'bg-red-50 text-red-400' : ss.available < 5 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                                                            }`}>
                                                                        {ss.size}:{ss.available}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* 주 평균 판매 수량 (실제 주문 데이터 기반) */}
                                                <td className="py-3 px-3 text-center">
                                                    {(() => {
                                                        const stat = salesStats[product.name];
                                                        if (!stat || stat.weeklyAvg <= 0) return <span className="text-xs text-slate-300">—</span>;
                                                        return (
                                                            <>
                                                                <span className="text-sm font-medium text-slate-700">
                                                                    {stat.weeklyAvg.toFixed(1)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 ml-0.5">개/주</span>
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                                {/* 예상 소진일 (실제 주간 판매량 기반) */}
                                                <td className="py-3 px-3 text-center">
                                                    {(() => {
                                                        const stat = salesStats[product.name];
                                                        if (!stat || stat.weeklyAvg <= 0 || product.stock <= 0) return <span className="text-xs text-slate-300">—</span>;
                                                        const days = Math.round(product.stock / stat.weeklyAvg * 7);
                                                        const isWarning = days <= 45;
                                                        return (
                                                            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${isWarning ? 'bg-red-50 text-red-600 border border-red-200' : 'text-slate-700'
                                                                }`}>
                                                                {days}일
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                {/* 판매 급증 (주평균 6개 이상이면 급증 표시) */}
                                                <td className="py-3 px-3 text-center">
                                                    {(() => {
                                                        const stat = salesStats[product.name];
                                                        if (stat && stat.weeklyAvg >= 6 && product.stock > 0) {
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    🔥 급증
                                                                </span>
                                                            );
                                                        }
                                                        return <span className="text-xs text-slate-300">—</span>;
                                                    })()}
                                                </td>
                                            </tr>

                                            {/* 확장 행 */}
                                            {isExpanded && (() => {
                                                const isEditing = editingIdx === uid && editDraft !== null;
                                                return (
                                                    <tr className="bg-slate-50/70">
                                                        <td colSpan={6} className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2 mb-3">
                                                                {!isEditing ? (
                                                                    <button
                                                                        onClick={() => startEdit(uid)}
                                                                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-colors"
                                                                        style={{ background: 'var(--primary)' }}>
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                        수정
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => cancelEdit()}
                                                                            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                                                                            취소
                                                                        </button>
                                                                        <button
                                                                            onClick={() => saveEdit(uid)}
                                                                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                            저장
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {/* 가격 정보 */}
                                                                <div className="bg-white rounded-lg border border-slate-200 p-4">
                                                                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">가격 정보</p>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-slate-500 w-14">정상가</span>
                                                                            <div className="flex items-center gap-1">
                                                                                {isEditing ? (
                                                                                    <input type="number" value={editDraft.tagPrice}
                                                                                        onChange={e => setEditDraft({ ...editDraft, tagPrice: Number(e.target.value) })}
                                                                                        className="w-28 px-2 py-1 text-sm text-right border border-indigo-300 rounded-md bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                                                                                ) : (
                                                                                    <span className="text-sm font-medium text-slate-900 w-28 text-right">{product.tagPrice.toLocaleString()}</span>
                                                                                )}
                                                                                <span className="text-xs text-slate-400">원</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-slate-500 w-14">판매가</span>
                                                                            <div className="flex items-center gap-1">
                                                                                {isEditing ? (
                                                                                    <input type="number" value={editDraft.sellingPrice}
                                                                                        onChange={e => setEditDraft({ ...editDraft, sellingPrice: Number(e.target.value) })}
                                                                                        className="w-28 px-2 py-1 text-sm text-right font-semibold text-indigo-600 border border-indigo-300 rounded-md bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                                                                                ) : (
                                                                                    <span className="text-sm font-semibold text-indigo-600 w-28 text-right">{product.sellingPrice.toLocaleString()}</span>
                                                                                )}
                                                                                <span className="text-xs text-slate-400">원</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-slate-500 w-14">원가</span>
                                                                            <div className="flex items-center gap-1">
                                                                                {isEditing ? (
                                                                                    <input type="number" value={editDraft.costPrice}
                                                                                        disabled={!isAdmin}
                                                                                        onChange={e => setEditDraft({ ...editDraft, costPrice: Number(e.target.value) })}
                                                                                        className={`w-28 px-2 py-1 text-sm text-right border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${!isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-100' : 'border-indigo-300 bg-indigo-50/30'}`}
                                                                                        title={!isAdmin ? '관리자만 수정 가능' : ''} />
                                                                                ) : (
                                                                                    <span className="text-sm font-medium text-slate-900 w-28 text-right">{product.costPrice.toLocaleString()}</span>
                                                                                )}
                                                                                <span className="text-xs text-slate-400">원</span>
                                                                                <button
                                                                                    onClick={() => setCostLogModal(product.styleCode)}
                                                                                    className="ml-1 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                                                                                    title="원가 수정이력 조회">
                                                                                    이력
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {!isAdmin && (
                                                                        <p className="text-[10px] text-amber-500 mt-1.5">🔒 원가 수정은 관리자 권한이 필요합니다</p>
                                                                    )}
                                                                </div>

                                                                {/* 재고 현황 — 사이즈별 */}
                                                                <div className="bg-white rounded-lg border border-slate-200 p-4">
                                                                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">재고 현황</p>
                                                                    <div className="flex justify-between text-sm mb-2">
                                                                        <span className="text-slate-500">총 가용재고</span>
                                                                        <span className={`font-semibold ${product.availableStock === 0 ? 'text-red-500' : 'text-emerald-600'}`}>{product.availableStock.toLocaleString()}</span>
                                                                    </div>
                                                                    {product.sizeStock && product.sizeStock.length > 0 ? (
                                                                        <div className="border-t border-slate-100 pt-2 mt-1">
                                                                            <p className="text-[10px] text-slate-400 mb-1.5">사이즈별 재고</p>
                                                                            <div className="grid grid-cols-2 gap-1">
                                                                                {product.sizeStock.map((ss) => (
                                                                                    <div key={ss.size} className={`flex items-center justify-between px-2 py-1 rounded text-xs ${ss.available === 0 ? 'bg-red-50' : ss.available < 5 ? 'bg-amber-50' : 'bg-emerald-50'
                                                                                        }`}>
                                                                                        <span className="font-medium text-slate-600">{ss.size}</span>
                                                                                        <span className={`font-bold ${ss.available === 0 ? 'text-red-500' : ss.available < 5 ? 'text-amber-600' : 'text-emerald-600'
                                                                                            }`}>{ss.available}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[10px] text-slate-400 mt-1">사이즈별 데이터 없음</p>
                                                                    )}
                                                                </div>

                                                                {/* 상품 정보 */}
                                                                <div className="bg-white rounded-lg border border-slate-200 p-4">
                                                                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">상품 정보</p>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-slate-500 w-14">카테고리</span>
                                                                            {isEditing ? (
                                                                                <select
                                                                                    value={editDraft.categoryM}
                                                                                    onChange={e => setEditDraft({ ...editDraft, categoryM: e.target.value })}
                                                                                    className="px-2 py-1 text-sm font-medium border border-indigo-300 rounded-md bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer">
                                                                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                                                </select>
                                                                            ) : (
                                                                                <span className="text-sm font-medium text-slate-900">{extractCategory(product.categoryM)}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-slate-500 w-14">품번</span>
                                                                            {isEditing ? (
                                                                                <input
                                                                                    type="text"
                                                                                    value={editDraft.styleCode}
                                                                                    onChange={e => setEditDraft({ ...editDraft, styleCode: e.target.value })}
                                                                                    className="w-36 px-2 py-1 text-sm font-mono font-medium border border-indigo-300 rounded-md bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                                                                    placeholder="예: I25SSPT001" />
                                                                            ) : (
                                                                                <span className="text-sm font-mono font-medium text-slate-900">{product.styleCode}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-slate-500 w-14">원산지</span>
                                                                            <span className="text-sm font-medium">{product.origin || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                    <p className="text-sm text-slate-500">
                        전체 {filtered.length}개 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}—{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} 표시
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={`w-8 h-8 flex items-center justify-center rounded text-sm border ${currentPage <= 1 ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 7) page = i + 1;
                            else if (currentPage <= 4) page = i + 1;
                            else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                            else page = currentPage - 3 + i;
                            return (
                                <button key={page} onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 flex items-center justify-center rounded text-sm border font-medium ${currentPage === page ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}>
                                    {page}
                                </button>
                            );
                        })}
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={`w-8 h-8 flex items-center justify-center rounded text-sm border ${currentPage >= totalPages ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* 이미지 규격 안내 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <span className="font-semibold">📸 이미지 규격:</span>{' '}
                    {IMAGE_WIDTH}×{IMAGE_HEIGHT}px (5:6 비율) · 지원 형식: JPG, PNG, WebP · 최대 5MB
                </p>
            </div>

            {/* 원가 수정이력 팝업 모달 */}
            {costLogModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCostLogModal(null)} />
                    <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-[420px] max-h-[400px] overflow-hidden animate-fade-in">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">원가 수정이력</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">품번: {costLogModal}</p>
                            </div>
                            <button onClick={() => setCostLogModal(null)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-5 py-3 max-h-[300px] overflow-y-auto">
                            {costPriceLog.filter(l => l.styleCode === costLogModal).length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="w-10 h-10 mx-auto mb-2 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-sm text-slate-400">수정이력이 없습니다</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {costPriceLog.filter(l => l.styleCode === costLogModal).map((log, li) => {
                                        const globalIdx = costPriceLog.indexOf(log);
                                        return (
                                            <div key={li} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors group">
                                                <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono">{log.changedAt}</span>
                                                <span className="text-xs text-red-400 line-through min-w-[70px] text-right">{log.oldValue.toLocaleString()}원</span>
                                                <span className="text-slate-300">→</span>
                                                <span className="text-xs text-emerald-600 font-semibold min-w-[70px]">{log.newValue.toLocaleString()}원</span>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => setCostPriceLog(prev => prev.filter((_, i) => i !== globalIdx))}
                                                        className="ml-auto opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                        title="이력 삭제">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 이미지 확대 프리뷰 모달 */}
            {imagePreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setImagePreview(null)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative animate-fade-in" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setImagePreview(null)}
                            className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-[500px]">
                            <img
                                src={imagePreview.url}
                                alt={imagePreview.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-auto object-contain"
                                onError={e => { (e.target as HTMLImageElement).src = ''; }}
                            />
                            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-700 truncate">{imagePreview.name}</p>
                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    이미지 변경
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                const newUrl = reader.result as string;
                                                setProducts(prev => prev.map(p =>
                                                    p.styleCode === imagePreview.styleCode ? { ...p, imageUrl: newUrl } : p
                                                ));
                                                setImagePreview(prev => prev ? { ...prev, url: newUrl } : null);
                                            };
                                            reader.readAsDataURL(file);
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
