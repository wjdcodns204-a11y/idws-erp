"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// HR 서브 메뉴
const HR_TABS = [
    { label: "직원 명부", href: "/hr/employees" },
    { label: "근태 조회", href: "/hr/attendance" },
    { label: "휴가 일정", href: "/hr/leaves" },
    { label: "💰 급여·연차", href: "/hr/payroll" },
    { label: "공용 캘린더", href: "/hr/calendar" },
    { label: "업무 보드", href: "/hr/tasks" },
];

export default function HRLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                        직원 관리 (HR & Work)
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        팀원의 정보, 출퇴근, 휴가 일정 및 업무를 한 눈에 파악하고 관리하세요.
                    </p>
                </div>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <Link
                        href="/hr"
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${pathname === "/hr"
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                            }`}
                    >
                        HR 대시보드
                    </Link>
                    {HR_TABS.map((tab) => {
                        const isActive = pathname.startsWith(tab.href);
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${isActive
                                    ? "border-indigo-500 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                                    }`}
                            >
                                {tab.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* 하위 페이지 컨텐츠 */}
            <div className="pt-2">
                {children}
            </div>
        </div>
    );
}
