"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-client";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createSupabaseBrowser();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // 이메일 입력 시 공백 제거 등 처리
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                return;
            }

            // 로그인 성공 시 대시보드 메인으로 이동
            router.push("/");
            // 강제 새로고침을 통해 레이아웃의 유저 정보를 갱신
            router.refresh();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("로그인 중 에러가 발생했습니다.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* 왼쪽: 브랜드 패널 */}
            <div
                className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
                style={{
                    background:
                        "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
                }}
            >
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        IDWS
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">Fashion ERP System</p>
                </div>

                <div className="animate-fade-in">
                    <blockquote className="text-xl text-slate-300 font-light leading-relaxed">
                        &quot;상품 등록부터 정산까지,
                        <br />
                        하나의 대시보드에서 관리하세요.&quot;
                    </blockquote>
                    <div className="mt-6 flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {["bg-indigo-400", "bg-emerald-400", "bg-amber-400"].map(
                                (bg, i) => (
                                    <div
                                        key={i}
                                        className={`w-8 h-8 rounded-full ${bg} border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white`}
                                    >
                                        {["M", "S", "L"][i]}
                                    </div>
                                )
                            )}
                        </div>
                        <p className="text-sm text-slate-400">
                            무신사 · 29CM · LLUD 통합 관리
                        </p>
                    </div>
                </div>

                <p className="text-xs text-slate-500">
                    © 2026 IDWS. All rights reserved.
                </p>
            </div>

            {/* 오른쪽: 로그인 폼 */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md animate-fade-in">
                    {/* 모바일 로고 */}
                    <div className="lg:hidden mb-8 text-center">
                        <h1 className="text-2xl font-bold text-slate-900">IDWS</h1>
                        <p className="text-sm text-slate-500">Fashion ERP System</p>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">로그인</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            ERP 시스템에 액세스하려면 로그인해 주세요.
                        </p>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                            <svg
                                className="w-4 h-4 shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="mt-6 space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-slate-700 mb-1.5"
                            >
                                이메일
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@idws.co.kr"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    비밀번호
                                </label>
                                <div className="text-xs text-indigo-600 hover:text-indigo-500 font-medium cursor-pointer" onClick={() => alert("초기 비밀번호는 1234 입니다. 변경이 필요하면 관리자에게 문의하세요.")}>
                                    비밀번호 찾기
                                </div>
                            </div>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: isLoading
                                    ? "#94a3b8"
                                    : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                            }}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg
                                        className="animate-spin w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    로그인 중...
                                </span>
                            ) : (
                                "로그인"
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-xs text-slate-400">
                        계정이 없으신가요? 관리자에게 초대를 요청해 주세요.
                    </p>
                </div>
            </div>
        </div>
    );
}
