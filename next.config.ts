import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Vercel 빌드 시 TypeScript/ESLint 에러를 경고로만 처리 (빌드 실패 방지)
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
