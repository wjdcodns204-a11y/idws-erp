import { createSupabaseServer } from '@/lib/supabase';

// 공통 함수: 생일이나 입사일이 오늘~7일 이내인지 확인
function isWithin7Days(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    try {
        const today = new Date();
        const target = new Date(dateStr);
        // 년도를 올해로 맞춤
        target.setFullYear(today.getFullYear());
        const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= -1 && diff <= 7; // 어제부터 7일 이내
    } catch {
        return false;
    }
}

function getDaysUntil(dateStr: string | null | undefined): number {
    if (!dateStr) return 999;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setFullYear(today.getFullYear());
        if (target < today) target.setFullYear(today.getFullYear() + 1);
        return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
        return 999;
    }
}

type CelebrationItem = {
    id: string;
    name: string;
    type: 'birthday' | 'anniversary';
    daysUntil: number;
    detail: string;
};

export default async function BirthdayWidget() {
    const supabase = await createSupabaseServer();

    const { data: employees } = await supabase
        .from('employees')
        .select('id, name, birth_date, hire_date')
        .eq('employee_status', 'active');

    if (!employees || employees.length === 0) return null;

    const celebrations: CelebrationItem[] = [];

    employees.forEach(emp => {
        if (isWithin7Days(emp.birth_date)) {
            celebrations.push({
                id: `${emp.id}-birthday`,
                name: emp.name,
                type: 'birthday',
                daysUntil: getDaysUntil(emp.birth_date),
                detail: new Date(emp.birth_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
            });
        }

        if (emp.hire_date && isWithin7Days(emp.hire_date)) {
            const hireYear = new Date(emp.hire_date).getFullYear();
            const thisYear = new Date().getFullYear();
            const yearsWorked = thisYear - hireYear;
            if (yearsWorked > 0) {
                celebrations.push({
                    id: `${emp.id}-anniversary`,
                    name: emp.name,
                    type: 'anniversary',
                    daysUntil: getDaysUntil(emp.hire_date),
                    detail: `${yearsWorked}주년`
                });
            }
        }
    });

    if (celebrations.length === 0) return null;

    // 가장 가까운 순으로 정렬
    celebrations.sort((a, b) => a.daysUntil - b.daysUntil);

    return (
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🎉</span>
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wide">이번 주 기념일</h3>
            </div>
            <div className="space-y-3">
                {celebrations.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{item.type === 'birthday' ? '🎂' : '🏆'}</span>
                            <div>
                                <p className="font-bold text-white text-sm">{item.name}님</p>
                                <p className="text-white/70 text-xs">
                                    {item.type === 'birthday' ? `생일 (${item.detail})` : `입사 ${item.detail}`}
                                </p>
                            </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.daysUntil === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'
                            }`}>
                            {item.daysUntil === 0 ? '오늘! 🎊' : `D-${item.daysUntil}`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
