'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ─── 사이즈 매핑 (style-code.ts와 동일) ───
const SIZE_MAP: Record<string, { suffix: string; label: string }> = {
    '0': { suffix: '_A', label: 'S' },
    '1': { suffix: '_B', label: 'M' },
    '2': { suffix: '_C', label: 'L' },
    '3': { suffix: '_D', label: 'XL' },
    '4': { suffix: '_E', label: 'XXL' },
    'OS': { suffix: '_F', label: 'FREE' },
};

// ─── 카테고리 목록 ───
const CATEGORIES = [
    { code: 'JK', name: '재킷', group: 'OUTER' },
    { code: 'JP', name: '점퍼', group: 'OUTER' },
    { code: 'DJ', name: '데님 점퍼', group: 'OUTER' },
    { code: 'CT', name: '코트', group: 'OUTER' },
    { code: 'VT', name: '베스트', group: 'OUTER' },
    { code: 'CD', name: '가디건', group: 'OUTER' },
    { code: 'TS', name: '티셔츠', group: 'TOP' },
    { code: 'NT', name: '니트', group: 'TOP' },
    { code: 'MT', name: '맨투맨', group: 'TOP' },
    { code: 'HD', name: '후드', group: 'TOP' },
    { code: 'SH', name: '셔츠', group: 'TOP' },
    { code: 'PT', name: '팬츠', group: 'BOTTOM' },
    { code: 'LP', name: '롱팬츠', group: 'BOTTOM' },
    { code: 'SP', name: '숏팬츠', group: 'BOTTOM' },
    { code: 'SK', name: '스커트', group: 'BOTTOM' },
    { code: 'DN', name: '데님', group: 'BOTTOM' },
    { code: 'AC', name: '액세서리', group: 'ACC' },
    { code: 'BG', name: '가방', group: 'ACC' },
    { code: 'HT', name: '모자', group: 'ACC' },
    { code: 'WJ', name: '주얼리', group: 'ACC' },
];

// ─── 색상 코드 프리셋 ───
const COLOR_PRESETS = [
    { code: 'BK', name: '블랙' },
    { code: 'WH', name: '화이트' },
    { code: 'NV', name: '네이비' },
    { code: 'GR', name: '그레이' },
    { code: 'BR', name: '브라운' },
    { code: 'BG', name: '베이지' },
    { code: 'IV', name: '아이보리' },
    { code: 'KH', name: '카키' },
    { code: 'CR', name: '크림' },
    { code: 'CH', name: '차콜' },
    { code: 'BL', name: '블루' },
    { code: 'RD', name: '레드' },
    { code: 'GN', name: '그린' },
    { code: 'PK', name: '핑크' },
    { code: 'MT', name: '멀티' },
    { code: 'SL', name: '실버' },
    { code: 'GD', name: '골드' },
    { code: 'OV', name: '올리브' },
    { code: 'PP', name: '퍼플' },
    { code: 'OR', name: '오렌지' },
];

interface VariantForm {
    colorCode: string;
    colorName: string;
    sellingPrice: string;
    sizes: string[];
}

export default function ProductNewPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentYear = new Date().getFullYear();

    const [name, setName] = useState('');
    const [year, setYear] = useState(String(currentYear));
    const [season, setSeason] = useState<'SS' | 'FW'>('SS');
    const [categoryCode, setCategoryCode] = useState('');
    const [tagPrice, setTagPrice] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [material, setMaterial] = useState('');
    const [description, setDescription] = useState('');

    const [variants, setVariants] = useState<VariantForm[]>([
        { colorCode: '', colorName: '', sellingPrice: '', sizes: [] },
    ]);

    const styleCodePreview = categoryCode
        ? `I${String(year).slice(-2)}${season}${categoryCode}___`
        : 'I__XX___';

    function addVariant() {
        setVariants([...variants, { colorCode: '', colorName: '', sellingPrice: '', sizes: [] }]);
    }

    function removeVariant(index: number) {
        if (variants.length <= 1) return;
        setVariants(variants.filter((_, i) => i !== index));
    }

    function updateVariant(index: number, field: keyof VariantForm, value: string | string[]) {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };
        if (field === 'colorCode') {
            const preset = COLOR_PRESETS.find((c) => c.code === value);
            if (preset) {
                updated[index].colorName = preset.name;
            }
        }
        setVariants(updated);
    }

    function toggleSize(variantIndex: number, size: string) {
        const updated = [...variants];
        const current = updated[variantIndex].sizes;
        if (current.includes(size)) {
            updated[variantIndex].sizes = current.filter((s) => s !== size);
        } else {
            updated[variantIndex].sizes = [...current, size].sort();
        }
        setVariants(updated);
    }

    function getSkuPreviews(variant: VariantForm) {
        if (!variant.colorCode || variant.sizes.length === 0) return [];
        return variant.sizes.map((size) => {
            const m = SIZE_MAP[size];
            return `${styleCodePreview.replace('___', '001')}-${variant.colorCode}${m?.suffix || '??'}`;
        });
    }

    function isOutlet(variant: VariantForm) {
        const tag = Number(tagPrice);
        const selling = Number(variant.sellingPrice);
        if (tag <= 0 || selling <= 0) return false;
        return selling <= tag * 0.5;
    }

    function discountRate(variant: VariantForm) {
        const tag = Number(tagPrice);
        const selling = Number(variant.sellingPrice);
        if (tag <= 0 || selling <= 0) return 0;
        return Math.round((1 - selling / tag) * 100);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!name.trim()) { setError('제품명을 입력해 주세요.'); return; }
        if (!categoryCode) { setError('카테고리를 선택해 주세요.'); return; }
        if (!tagPrice || Number(tagPrice) <= 0) { setError('정가(Tag가)를 입력해 주세요.'); return; }
        if (!costPrice || Number(costPrice) <= 0) { setError('원가를 입력해 주세요.'); return; }

        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            if (!v.colorCode) { setError(`${i + 1}번째 색상의 코드를 선택해 주세요.`); return; }
            if (!v.sellingPrice || Number(v.sellingPrice) <= 0) { setError(`${i + 1}번째 색상의 판매가를 입력해 주세요.`); return; }
            if (v.sizes.length === 0) { setError(`${i + 1}번째 색상의 사이즈를 1개 이상 선택해 주세요.`); return; }
        }

        setIsSubmitting(true);
        try {
            const body = {
                name: name.trim(),
                year: Number(year),
                season,
                categoryCode,
                tagPrice: Number(tagPrice),
                costPrice: Number(costPrice),
                material: material || undefined,
                description: description || undefined,
                variants: variants.map((v) => ({
                    colorCode: v.colorCode,
                    colorName: v.colorName,
                    sellingPrice: Number(v.sellingPrice),
                    sizes: v.sizes,
                })),
            };

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '상품 등록에 실패했습니다.');
            }

            router.push('/products');
        } catch (err) {
            setError(err instanceof Error ? err.message : '상품 등록에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    }

    const totalSKUs = variants.reduce((sum, v) => sum + v.sizes.length, 0);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link href="/products" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">상품 등록</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        스타일 코드: <span className="font-mono text-indigo-600 font-medium">{styleCodePreview}</span>
                        {totalSKUs > 0 && <span className="ml-2">· 생성될 SKU {totalSKUs}개</span>}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">기본 정보</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                제품명 <span className="text-red-500">*</span>
                            </label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="예: 멀티 집업 메일 재킷"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                연도 <span className="text-red-500">*</span>
                            </label>
                            <select value={year} onChange={(e) => setYear(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                시즌 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-3">
                                {(['SS', 'FW'] as const).map((s) => (
                                    <button key={s} type="button" onClick={() => setSeason(s)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${season === s
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                            }`}>
                                        {s === 'SS' ? '🌞 SS (봄/여름)' : '🍂 FW (가을/겨울)'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                카테고리 <span className="text-red-500">*</span>
                            </label>
                            <select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                <option value="">선택하세요</option>
                                {['OUTER', 'TOP', 'BOTTOM', 'ACC'].map((group) => (
                                    <optgroup key={group} label={group}>
                                        {CATEGORIES.filter((c) => c.group === group).map((c) => (
                                            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">소재</label>
                            <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)}
                                placeholder="예: 코튼 100%"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">가격 정보</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                정가 (Tag가) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input type="number" value={tagPrice} onChange={(e) => setTagPrice(e.target.value)}
                                    placeholder="189000"
                                    className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">원</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                원가 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)}
                                    placeholder="55000"
                                    className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">원</span>
                            </div>
                            {Number(tagPrice) > 0 && Number(costPrice) > 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                    마진율: {Math.round((1 - Number(costPrice) / Number(tagPrice)) * 100)}%
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">
                            색상 · 사이즈 <span className="text-sm font-normal text-slate-500">({variants.length}색상, {totalSKUs} SKU)</span>
                        </h2>
                        <button type="button" onClick={addVariant}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            색상 추가
                        </button>
                    </div>

                    <div className="space-y-4">
                        {variants.map((variant, idx) => (
                            <div key={idx} className="border border-slate-200 rounded-lg p-4 relative">
                                {variants.length > 1 && (
                                    <button type="button" onClick={() => removeVariant(idx)}
                                        className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">
                                            색상 코드 <span className="text-red-500">*</span>
                                        </label>
                                        <select value={variant.colorCode} onChange={(e) => updateVariant(idx, 'colorCode', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                            <option value="">색상 선택</option>
                                            {COLOR_PRESETS.map((c) => (
                                                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">색상명</label>
                                        <input type="text" value={variant.colorName} onChange={(e) => updateVariant(idx, 'colorName', e.target.value)}
                                            placeholder="블랙"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">
                                            판매가 <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input type="number" value={variant.sellingPrice} onChange={(e) => updateVariant(idx, 'sellingPrice', e.target.value)}
                                                placeholder="94500"
                                                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
                                        </div>
                                        {Number(variant.sellingPrice) > 0 && Number(tagPrice) > 0 && (
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className="text-xs text-red-500">-{discountRate(variant)}%</span>
                                                {isOutlet(variant) && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">아울렛</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-2">
                                        사이즈 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(SIZE_MAP).map(([size, { label }]) => (
                                            <button key={size} type="button" onClick={() => toggleSize(idx, size)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${variant.sizes.includes(size)
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                                    }`}>
                                                {label} ({size})
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {getSkuPreviews(variant).length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                                        <p className="text-xs font-medium text-slate-500 mb-1.5">자동 생성 SKU 미리보기:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {getSkuPreviews(variant).map((sku) => (
                                                <span key={sku} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-mono">
                                                    {sku}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">상세 설명 (선택)</h2>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                        rows={4} placeholder="상품에 대한 추가 설명을 입력하세요..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>

                <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6">
                    <p className="text-sm text-slate-500">
                        등록 시 <span className="font-medium text-slate-700">임시저장(DRAFT)</span> 상태로 생성됩니다.
                        <br />상품 목록에서 상태를 <span className="font-medium text-emerald-600">판매중(ACTIVE)</span>으로 변경할 수 있습니다.
                    </p>
                    <div className="flex gap-3">
                        <Link href="/products"
                            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            취소
                        </Link>
                        <button type="submit" disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    등록 중...
                                </span>
                            ) : (
                                '상품 등록'
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
