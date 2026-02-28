"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// 회사 위치: 서울 동대문구 천호대로83길 3
const COMPANY_LAT = 37.5724;
const COMPANY_LNG = 127.0299;
const ALLOWED_RADIUS_METERS = 10;  // 반경 10m 이내만 출퇴근 가능

// Haversine formula: 두 위경도 좌표 간의 거리(미터) 계산
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export default function MobileCheckIn({ currentEmployeeId }: { currentEmployeeId: string }) {
    const router = useRouter();
    const [distance, setDistance] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [status, setStatus] = useState<'idle' | 'allowed' | 'denied'>('idle');

    const checkLocation = () => {
        setIsChecking(true);
        setErrorMsg(null);
        setStatus('idle');

        if (!navigator.geolocation) {
            setErrorMsg("이 브라우저/기기는 위치 정보를 지원하지 않습니다.");
            setIsChecking(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const dist = getDistanceFromLatLonInM(COMPANY_LAT, COMPANY_LNG, userLat, userLng);

                setDistance(Math.round(dist));
                if (dist <= ALLOWED_RADIUS_METERS) {
                    setStatus('allowed');
                } else {
                    setStatus('denied');
                }
                setIsChecking(false);
            },
            (error) => {
                setIsChecking(false);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setErrorMsg("위치 정보 제공을 허용해주세요.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setErrorMsg("위치 정보를 가져올 수 없습니다.");
                        break;
                    case error.TIMEOUT:
                        setErrorMsg("위치 정보 요청 시간이 초과되었습니다.");
                        break;
                    default:
                        setErrorMsg("알 수 없는 위치 오류가 발생했습니다.");
                        break;
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleAction = async (actionType: 'check_in' | 'check_out') => {
        if (status !== 'allowed') return;

        try {
            const res = await fetch('/api/hr/attendance/mobile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: currentEmployeeId,
                    action: actionType,
                    lat: COMPANY_LAT, // or userLat
                    lng: COMPANY_LNG  // or userLng
                })
            });

            if (res.ok) {
                alert(`${actionType === 'check_in' ? '출근' : '퇴근'} 처리가 완료되었습니다.`);
                router.refresh();
            } else {
                const data = await res.json();
                alert(`처리 실패: ${data.error}`);
            }
        } catch (error: unknown) {
            alert(`오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center space-y-4">
            <div className="text-center">
                <h3 className="text-lg font-bold text-slate-800">모바일 출퇴근 도장</h3>
                <p className="text-xs text-slate-500 mt-1">회사 반경 {ALLOWED_RADIUS_METERS}m 이내에서만 가능합니다.</p>
            </div>

            <button
                onClick={checkLocation}
                disabled={isChecking}
                className="w-full max-w-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
                {isChecking ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        위치 확인 중...
                    </span>
                ) : '내 위치 확인하기 (GPS)'}
            </button>

            {errorMsg && (
                <div className="w-full max-w-xs p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm text-center">
                    {errorMsg}
                </div>
            )}

            {distance !== null && status === 'denied' && (
                <div className="w-full max-w-xs p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-sm text-center font-medium">
                    현재 회사로부터 <span className="font-bold text-amber-900">{distance}m</span> 떨어져 있습니다.<br />
                    (반경 {ALLOWED_RADIUS_METERS}m 이내 접근 요망)
                </div>
            )}

            {status === 'allowed' && (
                <div className="w-full max-w-xs space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-2 bg-emerald-50 text-emerald-700 text-xs font-bold text-center rounded-lg mb-4">
                        ✅ 회사 위치 반경 내에 있습니다. (오차 {distance}m)
                    </div>
                    <button onClick={() => handleAction('check_in')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
                        출근하기
                    </button>
                    <button onClick={() => handleAction('check_out')} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
                        퇴근하기
                    </button>
                </div>
            )}
        </div>
    );
}
