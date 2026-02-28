// src/channels/factory.ts
// 채널 어댑터 팩토리 — ChannelPlatform에 따라 적절한 어댑터 반환

import type { IChannelAdapter } from './types';
import { decryptPII } from '@/lib/encryption';

// 채널 플랫폼 타입 (Prisma 스키마와 동기화)
type ChannelPlatform = 'MUSINSA' | 'TWENTYNINE_CM' | 'CAFE24' | 'OWN_MALL' | 'OTHER';

/**
 * 암호화된 API 설정을 복호화하여 파싱합니다.
 */
function parseApiConfig(apiConfigEnc: string): Record<string, string> {
    const decrypted = decryptPII(apiConfigEnc);
    return JSON.parse(decrypted);
}

/**
 * 채널 플랫폼 유형에 맞는 어댑터를 생성합니다.
 * API 인증 정보는 DB에서 암호화된 상태로 가져와서 복호화 후 전달합니다.
 */
export async function createChannelAdapter(
    platform: ChannelPlatform,
    apiConfigEnc: string
): Promise<IChannelAdapter> {
    const config = parseApiConfig(apiConfigEnc);

    switch (platform) {
        case 'MUSINSA': {
            const { MusinsaAdapter } = await import('./musinsa.adapter');
            return new MusinsaAdapter(config);
        }
        case 'TWENTYNINE_CM': {
            const { TwentyNineCMAdapter } = await import('./twentynine-cm.adapter');
            return new TwentyNineCMAdapter(config);
        }
        case 'CAFE24': {
            const { Cafe24Adapter } = await import('./cafe24.adapter');
            return new Cafe24Adapter(config);
        }
        default:
            throw new Error(`[채널 오류] 지원하지 않는 플랫폼: ${platform}`);
    }
}
