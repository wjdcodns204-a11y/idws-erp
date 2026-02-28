"use client";

import { useSearchParams } from "next/navigation";

export default function HRSettingsPage() {
    const searchParams = useSearchParams();
    let statusMessage = null;
    if (searchParams.get('calendar_connected') === 'true') {
        statusMessage = { type: 'success' as const, text: '구글 캘린더 연동이 성공적으로 완료되었습니다! 🎉' };
    } else if (searchParams.get('error') === 'db_update_failed') {
        statusMessage = { type: 'error' as const, text: '캘린더 연동 중 시스템 오류가 발생했습니다. 관리자에게 문의하세요.' };
    }

    const handleGoogleConnect = () => {
        // 구글 OAuth 시작 엔드포인트로 이동
        window.location.href = '/api/auth/google';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[500px] animate-fade-in">
            <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">개인 환경설정</h2>
                <p className="text-sm text-slate-500 mt-1">외부 앱 연동 및 개인 정보(알림 등)를 관리합니다.</p>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {statusMessage.text}
                </div>
            )}

            <div className="space-y-6">
                {/* 캘린더 연동 섹션 */}
                <div className="border border-slate-200 rounded-xl p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-sm border border-slate-100 shrink-0">
                                {/* Google Calendar Icon Placeholder */}
                                <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16 2V6" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M8 2V6" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M3 10H21" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M11 14H13V16H11V14Z" fill="#EA4335" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">구글 캘린더(Google Calendar) 연동</h3>
                                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                    본인의 개인 구글 계정으로 로그인하여 캘린더 접근 권한을 허용해 주세요.<br />
                                    연동 시 휴가 일정 및 중요한 사내 일정이 개인 캘린더에 자동으로 동기화됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-end">
                            <button
                                onClick={handleGoogleConnect}
                                className="w-full md:w-auto px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                구글 계정으로 연동하기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
