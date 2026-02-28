import { createSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import SettingsClient from './components/SettingsClient';

// 접근 가능한 역할 목록 (대표님 + 이주영 + 최정민)
const ALLOWED_NAMES = ['정채운', '이주영', '최정민'];

export default async function SettingsPage() {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/');

    const { data: currentUser } = await supabase
        .from('employees')
        .select('*')
        .eq('email', session.user.email)
        .single();

    // 접근 권한 체크 (master이거나 허용된 이름인 경우)
    const isAllowed = currentUser?.role === 'master' || ALLOWED_NAMES.includes(currentUser?.name);

    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center border-4 border-red-50">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800">접근 권한이 없습니다</h2>
                <p className="text-slate-500 text-sm">시스템 설정은 권한이 있는 담당자만 수정 가능합니다.</p>
            </div>
        );
    }

    // 플랫폼 수수료 목록
    const { data: platformFees } = await supabase
        .from('platform_fees')
        .select('*')
        .order('platform_name');

    // 시스템 설정 목록 (API 키 등)
    const { data: systemSettings } = await supabase
        .from('system_settings')
        .select('*');

    // KPI 설정 로드
    const { data: kpiData } = await supabase
        .from('dashboard_kpi')
        .select('monthly_goal, low_stock_threshold')
        .maybeSingle();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">시스템 설정</h1>
                <p className="text-slate-500 text-sm mt-1">플랫폼 수수료 및 외부 API 키를 관리합니다. 권한자만 수정 가능합니다.</p>
            </div>
            <SettingsClient
                platformFees={platformFees || []}
                systemSettings={systemSettings || []}
                isMaster={currentUser?.role === 'master'}
                initialKpi={kpiData || { monthly_goal: 210000000, low_stock_threshold: 20 }}
            />
        </div>
    );
}
