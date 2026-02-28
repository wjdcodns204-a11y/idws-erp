"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Suspense 래핑 필요: useSearchParams()는 서버에서 렌더 시 fallback이 필요함
export default function SignupPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-50">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                </div>
            }
        >
            <SignupForm />
        </Suspense>
    );
}

function SignupForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [invitationEmail, setInvitationEmail] = useState("");
    const [invitationRole, setInvitationRole] = useState("");

    useEffect(() => {
        if (!token) {
            setTokenValid(false);
            return;
        }
        // TODO: 서버에서 토큰 유효성 검증 API 호출
        setTokenValid(true);
        setInvitationEmail("invited@idws.co.kr");
        setInvitationRole("MD");
    }, [token]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== passwordConfirm) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (password.length < 8) {
            setError("비밀번호는 8자 이상이어야 합니다.");
            return;
        }

        setIsLoading(true);
        try {
            // TODO: Supabase Auth 계정 생성 + User 레코드 생성
            await new Promise((resolve) => setTimeout(resolve, 1000));
            alert("Supabase 연동 후 실제 가입이 활성화됩니다.");
        } catch {
            setError("계정 생성 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    // 토큰 없거나 유효하지 않은 경우
    if (tokenValid === false) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
                <div className="text-center max-w-md animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">유효하지 않은 초대 링크</h2>
                    <p className="mt-2 text-sm text-slate-500">
                        초대 링크가 만료되었거나 이미 사용되었습니다.
                        <br />
                        관리자에게 새로운 초대를 요청해 주세요.
                    </p>
                    <a href="/login" className="inline-block mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                        ← 로그인으로 돌아가기
                    </a>
                </div>
            </div>
        );
    }

    // 토큰 검증 중
    if (tokenValid === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
            <div className="w-full max-w-md animate-fade-in">
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-slate-900">IDWS ERP</h1>
                        <p className="text-sm text-slate-500 mt-1">계정 만들기</p>
                    </div>

                    {/* 초대 정보 뱃지 */}
                    <div className="bg-indigo-50 rounded-lg p-4 mb-6 border border-indigo-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-indigo-900">{invitationEmail}</p>
                                <p className="text-xs text-indigo-600">역할: <span className="font-semibold">{invitationRole}</span></p>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-5">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">이름</label>
                            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm transition-all placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div>
                            <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호</label>
                            <input id="signup-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" minLength={8}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm transition-all placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div>
                            <label htmlFor="password-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호 확인</label>
                            <input id="password-confirm" type="password" required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="비밀번호를 다시 입력해 주세요"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm transition-all placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <button type="submit" disabled={isLoading}
                            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: isLoading ? "#94a3b8" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                            {isLoading ? "계정 생성 중..." : "계정 만들기"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-slate-400">
                        이미 계정이 있으신가요?{" "}
                        <a href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">로그인</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
