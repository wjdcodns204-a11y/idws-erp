'use client';

import { useState } from 'react';

type Sample = {
    id: string; product_name: string; sku: string; category: string;
    sample_type: string; status: string; quantity: number;
    factory_name: string; expected_date: string; received_date: string;
    location: string; color: string; size_spec: string; memo: string;
    created_by: string; created_at: string;
};

type FabricSupplier = {
    id: string; name: string; category: string; contact_name: string;
    contact_phone: string; specialty: string; unit_price_range: string;
    lead_time_days: number; rating: number; payment_terms: string; memo: string;
};

type SizeSpec = {
    id: string; product_name: string; sku: string; season: string; size_label: string;
    total_length: number; chest: number; shoulder: number; sleeve: number; waist: number;
    hip: number; thigh: number; rise: number; inseam: number; hem_width: number;
};

type Tab = 'samples' | 'fabric' | 'size';

const SAMPLE_STATUS_CONFIG: Record<string, { color: string }> = {
    '제작중': { color: 'bg-blue-100 text-blue-700' },
    '검토중': { color: 'bg-amber-100 text-amber-700' },
    '수정요청': { color: 'bg-orange-100 text-orange-700' },
    '승인': { color: 'bg-emerald-100 text-emerald-700' },
    '반려': { color: 'bg-red-100 text-red-700' },
    '회수': { color: 'bg-slate-100 text-slate-500' },
};

const SAMPLE_TYPES = ['1차샘플', '2차샘플', '최종샘플', '판매샘플'];
const SAMPLE_STATUSES = ['제작중', '검토중', '수정요청', '승인', '반려', '회수'];
const FABRIC_CATEGORIES = ['원단', '부자재', '원사', '염색', '봉제', '기타'];
const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE', '44', '55', '66', '77', '88'];

export default function PlmEnhancedClient({
    initialSamples, initialFabricSuppliers, initialSizeSpecs,
}: {
    initialSamples: Sample[];
    initialFabricSuppliers: FabricSupplier[];
    initialSizeSpecs: SizeSpec[];
}) {
    const [tab, setTab] = useState<Tab>('samples');
    const [samples, setSamples] = useState<Sample[]>(initialSamples);
    const [fabricSuppliers, setFabricSuppliers] = useState<FabricSupplier[]>(initialFabricSuppliers);
    const [sizeSpecs, setSizeSpecs] = useState<SizeSpec[]>(initialSizeSpecs);
    const [saving, setSaving] = useState(false);
    const [filterStatus, setFilterStatus] = useState('전체');
    const [showSampleForm, setShowSampleForm] = useState(false);
    const [showFabricForm, setShowFabricForm] = useState(false);

    // 샘플 폼
    const [sampleForm, setSampleForm] = useState({
        product_name: '', sku: '', category: '', sample_type: '1차샘플',
        status: '제작중', quantity: 1, factory_name: '', expected_date: '',
        color: '', size_spec: '', location: '사내보관', memo: '',
    });

    // 원단공급업체 폼
    const [fabricForm, setFabricForm] = useState({
        name: '', category: '원단', contact_name: '', contact_phone: '',
        specialty: '', unit_price_range: '', lead_time_days: 14, rating: 3,
        payment_terms: '30일 후불', memo: '',
    });

    // 사이즈 스펙 폼
    const [sizeForm, setSizeForm] = useState({
        product_name: '', sku: '', season: '26SS', size_label: 'M',
        total_length: 0, chest: 0, shoulder: 0, sleeve: 0, waist: 0,
        hip: 0, thigh: 0, rise: 0, inseam: 0, hem_width: 0,
    });

    const filteredSamples = filterStatus === '전체' ? samples : samples.filter(s => s.status === filterStatus);

    // 샘플 저장
    const handleSampleSave = async () => {
        if (!sampleForm.product_name.trim()) return alert('상품명을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/plm/samples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sampleForm),
        });
        if (res.ok) {
            const data = await res.json();
            setSamples(prev => [data, ...prev]);
            setShowSampleForm(false);
            setSampleForm({ product_name: '', sku: '', category: '', sample_type: '1차샘플', status: '제작중', quantity: 1, factory_name: '', expected_date: '', color: '', size_spec: '', location: '사내보관', memo: '' });
        }
        setSaving(false);
    };

    // 샘플 상태 변경
    const handleSampleStatus = async (id: string, status: string) => {
        await fetch('/api/plm/samples', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        });
        setSamples(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    // 원단공급업체 저장
    const handleFabricSave = async () => {
        if (!fabricForm.name.trim()) return alert('업체명을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/plm/fabric-suppliers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fabricForm),
        });
        if (res.ok) {
            const data = await res.json();
            setFabricSuppliers(prev => [...prev, data]);
            setShowFabricForm(false);
            setFabricForm({ name: '', category: '원단', contact_name: '', contact_phone: '', specialty: '', unit_price_range: '', lead_time_days: 14, rating: 3, payment_terms: '30일 후불', memo: '' });
        }
        setSaving(false);
    };

    // 사이즈 스펙 저장
    const handleSizeSave = async () => {
        if (!sizeForm.product_name.trim()) return alert('상품명을 입력해주세요.');
        setSaving(true);
        const res = await fetch('/api/plm/size-specs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sizeForm),
        });
        if (res.ok) {
            const data = await res.json();
            setSizeSpecs(prev => [...prev, data]);
            setSizeForm({ product_name: '', sku: '', season: '26SS', size_label: 'M', total_length: 0, chest: 0, shoulder: 0, sleeve: 0, waist: 0, hip: 0, thigh: 0, rise: 0, inseam: 0, hem_width: 0 });
        }
        setSaving(false);
    };

    const handleSizeDelete = async (id: string) => {
        await fetch('/api/plm/size-specs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        setSizeSpecs(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">상품 PLM 강화</h1>
                <p className="text-sm text-slate-500 mt-1">샘플 관리, 원단/소재 공급업체, 사이즈 스펙을 관리합니다.</p>
            </div>

            {/* 탭 */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {([['samples', `🧵 샘플 관리 (${samples.length})`], ['fabric', `🏭 원단 공급업체 (${fabricSuppliers.length})`], ['size', `📏 사이즈 스펙 (${sizeSpecs.length})`]] as [Tab, string][]).map(([t, label]) => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    {tab === 'samples' && (
                        <button onClick={() => setShowSampleForm(!showSampleForm)}
                            className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl">
                            + 샘플 등록
                        </button>
                    )}
                    {tab === 'fabric' && (
                        <button onClick={() => setShowFabricForm(!showFabricForm)}
                            className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl">
                            + 업체 등록
                        </button>
                    )}
                </div>
            </div>

            {/* ── 샘플 관리 탭 ── */}
            {tab === 'samples' && (
                <div className="space-y-4">
                    {/* 샘플 등록 폼 */}
                    {showSampleForm && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">🧵 샘플 등록</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">상품명 *</label>
                                    <input type="text" value={sampleForm.product_name}
                                        onChange={e => setSampleForm(p => ({ ...p, product_name: e.target.value }))}
                                        placeholder="상품명" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">SKU</label>
                                    <input type="text" value={sampleForm.sku}
                                        onChange={e => setSampleForm(p => ({ ...p, sku: e.target.value }))}
                                        placeholder="SKU" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">샘플 유형</label>
                                    <select value={sampleForm.sample_type} onChange={e => setSampleForm(p => ({ ...p, sample_type: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                        {SAMPLE_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">공장명</label>
                                    <input type="text" value={sampleForm.factory_name}
                                        onChange={e => setSampleForm(p => ({ ...p, factory_name: e.target.value }))}
                                        placeholder="공장명" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">색상</label>
                                    <input type="text" value={sampleForm.color}
                                        onChange={e => setSampleForm(p => ({ ...p, color: e.target.value }))}
                                        placeholder="블랙, 화이트..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">사이즈</label>
                                    <input type="text" value={sampleForm.size_spec}
                                        onChange={e => setSampleForm(p => ({ ...p, size_spec: e.target.value }))}
                                        placeholder="M, Free..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">납기 예정일</label>
                                    <input type="date" value={sampleForm.expected_date}
                                        onChange={e => setSampleForm(p => ({ ...p, expected_date: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="col-span-2 sm:col-span-4">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">메모</label>
                                    <input type="text" value={sampleForm.memo}
                                        onChange={e => setSampleForm(p => ({ ...p, memo: e.target.value }))}
                                        placeholder="참고사항" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setShowSampleForm(false)} className="px-5 py-2 text-sm font-bold bg-slate-100 rounded-xl">취소</button>
                                <button onClick={handleSampleSave} disabled={saving} className="px-7 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:bg-slate-300">
                                    {saving ? '저장 중...' : '샘플 등록'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 상태 필터 */}
                    <div className="flex gap-2 flex-wrap">
                        {['전체', ...SAMPLE_STATUSES].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterStatus === s ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* 샘플 목록 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-center">상태</th>
                                    <th className="px-4 py-3 text-left">상품명</th>
                                    <th className="px-4 py-3 text-left hidden sm:table-cell">유형</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">색상/사이즈</th>
                                    <th className="px-4 py-3 text-left hidden lg:table-cell">공장</th>
                                    <th className="px-4 py-3 text-center hidden sm:table-cell">납기예정</th>
                                    <th className="px-4 py-3 text-center">상태 변경</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSamples.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">샘플이 없습니다</td></tr>
                                ) : filteredSamples.map(s => (
                                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${SAMPLE_STATUS_CONFIG[s.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800">{s.product_name}</p>
                                            <p className="text-xs text-slate-400">{s.sku || '-'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{s.sample_type}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{s.color} {s.size_spec}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{s.factory_name || '-'}</td>
                                        <td className="px-4 py-3 text-center text-xs text-slate-400 hidden sm:table-cell">{s.expected_date || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <select value={s.status} onChange={e => handleSampleStatus(s.id, e.target.value)}
                                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
                                                {SAMPLE_STATUSES.map(st => <option key={st}>{st}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── 원단 공급업체 탭 ── */}
            {tab === 'fabric' && (
                <div className="space-y-4">
                    {showFabricForm && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">🏭 원단 공급업체 등록</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { label: '업체명 *', key: 'name', type: 'text', placeholder: '(주)원단업체' },
                                    { label: '연락처', key: 'contact_phone', type: 'text', placeholder: '010-0000-0000' },
                                    { label: '담당자', key: 'contact_name', type: 'text', placeholder: '담당자명' },
                                    { label: '주력 소재', key: 'specialty', type: 'text', placeholder: '면, 폴리에스터...' },
                                    { label: '단가 범위', key: 'unit_price_range', type: 'text', placeholder: '5,000~10,000원/m' },
                                    { label: '납기일(일)', key: 'lead_time_days', type: 'number', placeholder: '14' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                                        <input type={f.type} value={(fabricForm as never)[f.key] || ''}
                                            onChange={e => setFabricForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                            placeholder={f.placeholder}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">카테고리</label>
                                    <select value={fabricForm.category} onChange={e => setFabricForm(p => ({ ...p, category: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                        {FABRIC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">평점</label>
                                    <select value={fabricForm.rating} onChange={e => setFabricForm(p => ({ ...p, rating: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                        {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{'⭐'.repeat(r)}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setShowFabricForm(false)} className="px-5 py-2 text-sm font-bold bg-slate-100 rounded-xl">취소</button>
                                <button onClick={handleFabricSave} disabled={saving} className="px-7 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:bg-slate-300">
                                    {saving ? '저장 중...' : '업체 등록'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {fabricSuppliers.length === 0 ? (
                            <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">등록된 공급업체가 없습니다</div>
                        ) : fabricSuppliers.map(f => (
                            <div key={f.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-slate-800">{f.name}</span>
                                    <span className="text-xs text-amber-500">{'⭐'.repeat(f.rating)}</span>
                                </div>
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{f.category}</span>
                                <div className="mt-3 space-y-1 text-xs text-slate-500">
                                    {f.specialty && <p>🧵 주력: {f.specialty}</p>}
                                    {f.contact_phone && <p>📞 {f.contact_name} {f.contact_phone}</p>}
                                    {f.unit_price_range && <p>💰 {f.unit_price_range}</p>}
                                    <p>⏱ 납기 {f.lead_time_days}일 · {f.payment_terms}</p>
                                </div>
                                {f.memo && <p className="mt-2 text-xs text-slate-400 italic">{f.memo}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 사이즈 스펙 탭 ── */}
            {tab === 'size' && (
                <div className="space-y-4">
                    {/* 사이즈 스펙 입력 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">📏 사이즈 스펙 추가</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">상품명 *</label>
                                <input type="text" value={sizeForm.product_name}
                                    onChange={e => setSizeForm(p => ({ ...p, product_name: e.target.value }))}
                                    placeholder="상품명" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">SKU</label>
                                <input type="text" value={sizeForm.sku}
                                    onChange={e => setSizeForm(p => ({ ...p, sku: e.target.value }))}
                                    placeholder="SKU" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">시즌</label>
                                <input type="text" value={sizeForm.season}
                                    onChange={e => setSizeForm(p => ({ ...p, season: e.target.value }))}
                                    placeholder="26SS" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">사이즈</label>
                                <select value={sizeForm.size_label} onChange={e => setSizeForm(p => ({ ...p, size_label: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                                    {SIZE_LABELS.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            {[
                                { label: '총장(cm)', key: 'total_length' },
                                { label: '가슴둘레', key: 'chest' },
                                { label: '어깨너비', key: 'shoulder' },
                                { label: '소매길이', key: 'sleeve' },
                                { label: '허리둘레', key: 'waist' },
                                { label: '힙둘레', key: 'hip' },
                                { label: '허벅지', key: 'thigh' },
                                { label: '밑위', key: 'rise' },
                                { label: '밑단길이', key: 'inseam' },
                                { label: '밑단너비', key: 'hem_width' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                                    <input type="number" step="0.1" value={(sizeForm as never)[f.key] || ''}
                                        onChange={e => setSizeForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                                        placeholder="0"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleSizeSave} disabled={saving}
                            className="mt-4 w-full py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:bg-slate-300">
                            {saving ? '저장 중...' : '사이즈 스펙 저장'}
                        </button>
                    </div>

                    {/* 사이즈 스펙 목록 */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">상품명</th>
                                    <th className="px-4 py-3 text-center">사이즈</th>
                                    <th className="px-4 py-3 text-right">총장</th>
                                    <th className="px-4 py-3 text-right">가슴</th>
                                    <th className="px-4 py-3 text-right">어깨</th>
                                    <th className="px-4 py-3 text-right">소매</th>
                                    <th className="px-4 py-3 text-right">허리</th>
                                    <th className="px-4 py-3 text-center">삭제</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sizeSpecs.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">사이즈 스펙이 없습니다</td></tr>
                                ) : sizeSpecs.map(s => (
                                    <tr key={s.id} className="border-b border-slate-50">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-800">{s.product_name}</p>
                                            <p className="text-xs text-slate-400">{s.sku} · {s.season}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{s.size_label}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{s.total_length || '-'}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{s.chest || '-'}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{s.shoulder || '-'}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{s.sleeve || '-'}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{s.waist || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleSizeDelete(s.id)}
                                                className="text-xs px-2 py-1 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all">삭제</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
