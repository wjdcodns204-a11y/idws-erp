import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { fees } = await request.json();
        const supabase = createSupabaseAdmin();

        for (const fee of fees) {
            const { error } = await supabase
                .from('platform_fees')
                .update({ fee_pct: fee.fee_pct, color: fee.color })
                .eq('id', fee.id);
            if (error) console.error('수수료 업데이트 실패:', fee.platform_name, error);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}

export async function GET() {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase.from('platform_fees').select('*').order('platform_name');
    return NextResponse.json({ fees: data || [] });
}
