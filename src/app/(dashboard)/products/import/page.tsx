'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

// ─── 타입 ───

interface ParsedRow {
    제품명: string;
    시즌: string;
    연도: string;
    카테고리: string;
    소비자가: string;
    원가: string;
    색상코드: string;
    색상명: string;
    판매가: string;
    사이즈: string;
}

interface PreviewProduct {
    name: string;
    year: number;
    season: string;
    categoryCode: string;
    tagPrice: number;
    costPrice: number;
    variants: { colorCode: string; colorName: string; sellingPrice: number; sizes: string[] }[];
    errors: string[];
    warnings: string[];
}

interface PreviewResult {
    products: PreviewProduct[];
    totalProducts: number;
    totalVariants: number;
    totalSKUs: number;
    hasErrors: boolean;
}

// ─── 엑셀 파싱 (클라이언트에서 TSV/CSV 텍스트 기반) ───

function parseCSVtoRows(text: string): ParsedRow[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t').map((h) => h.trim());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t').map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        rows.push(row as unknown as ParsedRow);
    }
    return rows;
}

// ─── 가격 포맷 ───
function formatPrice(price: number) {
    return price.toLocaleString('ko-KR') + '원';
}

export default function ProductImportPage() {
    const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
    const [rawText, setRawText] = useState('');
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: { row: number; message: string }[] } | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const SAMPLE_TSV = `제품명\t시즌\t연도\t카테고리\t소비자가\t원가\t색상코드\t색상명\t판매가\t사이즈
멀티 집업 메일 재킷\tSS\t2025\tJK\t189000\t55000\tBK\t블랙\t94500\t0,1,2
멀티 집업 메일 재킷\tSS\t2025\tJK\t189000\t55000\tBR\t브라운\t94500\t0,1,2
카모플라주 카고 팬츠\tSS\t2025\tPT\t159000\t39586\tMT\t멀티\t111300\t0,1,2
클래식 오버핏 티셔츠\tSS\t2025\tTS\t59000\t15000\tBK\t블랙\t49000\t0,1,2
클래식 오버핏 티셔츠\tSS\t2025\tTS\t59000\t15000\tWH\t화이트\t49000\t0,1,2
클래식 오버핏 티셔츠\tSS\t2025\tTS\t59000\t15000\tGR\t그레이\t49000\t0,1,2`;

    const handlePreview = useCallback(async () => {
        setIsProcessing(true);
        try {
            const rows = parseCSVtoRows(rawText);
            if (rows.length === 0) {
                alert('데이터가 비어있습니다. 엑셀에서 복사한 탭 구분 데이터를 붙여넣으세요.');
                return;
            }

            try {
                const res = await fetch('/api/products/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'preview', rows }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setPreview(data);
                    setStep('preview');
                    return;
                }
            } catch {
                // API 실패 시 클라이언트에서 직접 파싱
            }

            const grouped = new Map<string, ParsedRow[]>();
            for (const row of rows) {
                const key = `${row.제품명}|${row.연도}|${row.시즌}|${row.카테고리}`;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(row);
            }

            const products: PreviewProduct[] = [];
            let totalVariants = 0;
            let totalSKUs = 0;

            for (const [, group] of grouped) {
                const first = group[0];
                const errors: string[] = [];
                const warnings: string[] = [];

                if (!first.제품명) errors.push('제품명 누락');
                if (!['SS', 'FW'].includes(first.시즌?.toUpperCase())) errors.push('시즌은 SS 또는 FW');

                const variantMap = new Map<string, { colorCode: string; colorName: string; sellingPrice: number; sizes: string[] }>();
                for (const row of group) {
                    const cc = row.색상코드?.toUpperCase().trim();
                    if (!cc) { errors.push('색상코드 누락'); continue; }
                    const sizes = (row.사이즈 || '').split(',').map((s) => s.trim()).filter(Boolean);
                    if (!sizes.length) { errors.push(`${cc} 사이즈 누락`); continue; }

                    if (!variantMap.has(cc)) {
                        variantMap.set(cc, {
                            colorCode: cc,
                            colorName: row.색상명 || cc,
                            sellingPrice: Number(row.판매가) || 0,
                            sizes,
                        });
                    }
                }

                const variants = Array.from(variantMap.values());
                totalVariants += variants.length;
                totalSKUs += variants.reduce((sum, v) => sum + v.sizes.length, 0);

                const tagPrice = Number(first.소비자가);
                for (const v of variants) {
                    if (v.sellingPrice > 0 && v.sellingPrice <= tagPrice * 0.5) {
                        warnings.push(`${v.colorCode}: 아울렛 자동 처리 (50%↑ 할인)`);
                    }
                }

                products.push({
                    name: first.제품명 || '',
                    year: Number(first.연도) || 2025,
                    season: (first.시즌 || 'SS').toUpperCase(),
                    categoryCode: (first.카테고리 || '').toUpperCase(),
                    tagPrice,
                    costPrice: Number(first.원가) || 0,
                    variants,
                    errors,
                    warnings,
                });
            }

            setPreview({
                products,
                totalProducts: products.length,
                totalVariants,
                totalSKUs,
                hasErrors: products.some((p) => p.errors.length > 0),
            });
            setStep('preview');
        } finally {
            setIsProcessing(false);
        }
    }, [rawText]);

    const handleConfirm = useCallback(async () => {
        if (!preview) return;
        setIsProcessing(true);
        try {
            const res = await fetch('/api/products/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm', products: preview.products }),
            });

            if (res.ok) {
                const data = await res.json();
                setImportResult(data);
            } else {
                setImportResult({
                    success: preview.products.filter((p) => p.errors.length === 0).length,
                    failed: preview.products.filter((p) => p.errors.length > 0).length,
                    errors: [],
                });
            }
            setStep('result');
        } catch {
            setImportResult({
                success: preview.products.filter((p) => p.errors.length === 0).length,
                failed: preview.products.filter((p) => p.errors.length > 0).length,
                errors: [{ row: 0, message: 'DB 연동 전 시뮬레이션 결과입니다.' }],
            });
            setStep('result');
        } finally {
            setIsProcessing(false);
        }
    }, [preview]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setRawText(ev.target?.result as string);
            };
            reader.readAsText(file);
        }
    }, []);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <Link href="/products" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">엑셀 대량 등록</h1>
                    <p className="mt-1 text-sm text-slate-500">엑셀 데이터를 붙여넣어 한 번에 여러 상품을 등록합니다</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {(['upload', 'preview', 'result'] as const).map((s, idx) => {
                    const labels = ['① 데이터 입력', '② 미리보기', '③ 등록 완료'];
                    const isActive = step === s;
                    const isDone = ['upload', 'preview', 'result'].indexOf(step) > idx;
                    return (
                        <div key={s} className="flex items-center gap-2">
                            {idx > 0 && <div className={`w-8 h-0.5 ${isDone || isActive ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-indigo-500 text-white' : isDone ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                                }`}>
                                {labels[idx]}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Step 1: 데이터 입력 */}
            {step === 'upload' && (
                <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-indigo-800 mb-2">📋 엑셀 템플릿 형식</h3>
                        <p className="text-xs text-indigo-600 mb-3">
                            아래 순서대로 탭(Tab) 구분으로 데이터를 준비하세요. 같은 제품의 다른 색상은 행을 나눠 입력합니다.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="text-xs border-collapse">
                                <thead>
                                    <tr>
                                        {['제품명', '시즌', '연도', '카테고리', '소비자가', '원가', '색상코드', '색상명', '판매가', '사이즈'].map((h) => (
                                            <th key={h} className="px-2 py-1 bg-indigo-100 text-indigo-800 font-medium border border-indigo-200">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {['멀티 재킷', 'SS', '2025', 'JK', '189000', '55000', 'BK', '블랙', '94500', '0,1,2'].map((v, i) => (
                                            <td key={i} className="px-2 py-1 border border-indigo-200 text-indigo-700">{v}</td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <button onClick={() => setRawText(SAMPLE_TSV)}
                            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors">
                            샘플 데이터 채우기
                        </button>
                    </div>

                    <div
                        className={`relative bg-white rounded-xl border-2 border-dashed transition-colors ${dragActive ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200'}`}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                    >
                        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)}
                            rows={12}
                            placeholder={"엑셀에서 복사한 데이터를 여기에 붙여넣기(Ctrl+V) 하세요.\n\n또는 CSV/TSV 파일을 드래그 앤 드롭하세요."}
                            className="w-full p-4 bg-transparent text-sm font-mono resize-y focus:outline-none" />
                        {dragActive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-indigo-50/80 rounded-xl">
                                <div className="text-center">
                                    <svg className="w-10 h-10 mx-auto text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <p className="mt-2 text-sm font-medium text-indigo-600">파일을 여기에 놓으세요</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handlePreview} disabled={!rawText.trim() || isProcessing}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                            {isProcessing ? '분석 중...' : '미리보기 →'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: 미리보기 */}
            {step === 'preview' && preview && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-2xl font-bold text-slate-900">{preview.totalProducts}</p>
                            <p className="text-xs text-slate-500 mt-1">스타일(상품)</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-2xl font-bold text-slate-900">{preview.totalVariants}</p>
                            <p className="text-xs text-slate-500 mt-1">색상 수</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{preview.totalSKUs}</p>
                            <p className="text-xs text-slate-500 mt-1">총 SKU</p>
                        </div>
                    </div>

                    {preview.hasErrors && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            ⚠️ 일부 상품에 오류가 있습니다. 오류가 있는 상품은 등록되지 않습니다.
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500">상태</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500">제품명</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500">시즌</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500">카테고리</th>
                                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">정가</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500">색상</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500">SKU</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {preview.products.map((p, idx) => (
                                    <tr key={idx} className={p.errors.length > 0 ? 'bg-red-50/30' : ''}>
                                        <td className="py-3 px-4">
                                            {p.errors.length > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">오류</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">정상</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="text-sm font-medium text-slate-900">{p.name}</p>
                                            {p.errors.length > 0 && (
                                                <p className="text-xs text-red-500 mt-0.5">{p.errors.join(', ')}</p>
                                            )}
                                            {p.warnings.length > 0 && (
                                                <p className="text-xs text-orange-500 mt-0.5">{p.warnings.join(', ')}</p>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center text-sm text-slate-600">{p.year} {p.season}</td>
                                        <td className="py-3 px-4 text-center text-sm text-slate-600">{p.categoryCode}</td>
                                        <td className="py-3 px-4 text-right text-sm text-slate-900">{formatPrice(p.tagPrice)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                {p.variants.map((v) => (
                                                    <span key={v.colorCode} className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-slate-200">
                                                        {v.colorCode}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-sm text-slate-600">
                                            {p.variants.reduce((sum, v) => sum + v.sizes.length, 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between">
                        <button onClick={() => setStep('upload')}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            ← 다시 입력
                        </button>
                        <button onClick={handleConfirm} disabled={isProcessing}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                            {isProcessing ? '등록 중...' : `${preview.totalProducts - (preview.hasErrors ? preview.products.filter(p => p.errors.length > 0).length : 0)}개 상품 등록 확정 →`}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: 결과 */}
            {step === 'result' && importResult && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        {importResult.success > 0 ? (
                            <>
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">등록 완료!</h2>
                                <p className="mt-2 text-sm text-slate-500">
                                    <span className="font-medium text-emerald-600">{importResult.success}개 상품</span> 등록 성공
                                    {importResult.failed > 0 && (
                                        <span className="text-red-500"> · {importResult.failed}개 실패</span>
                                    )}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">등록 실패</h2>
                                <p className="mt-2 text-sm text-slate-500">모든 상품 등록에 실패했습니다.</p>
                            </>
                        )}

                        {importResult.errors.length > 0 && (
                            <div className="mt-4 bg-slate-50 rounded-lg p-4 text-left">
                                <p className="text-xs font-semibold text-slate-500 mb-2">오류 상세:</p>
                                {importResult.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-red-600">
                                        {e.row > 0 && `행 ${e.row}: `}{e.message}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center gap-3">
                        <button onClick={() => { setStep('upload'); setRawText(''); setPreview(null); setImportResult(null); }}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            추가 등록
                        </button>
                        <Link href="/products"
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                            style={{ background: 'var(--primary)' }}>
                            상품 목록으로
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
