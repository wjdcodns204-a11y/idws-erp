import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { goals } = await request.json();
        const supabase = createSupabaseAdmin();

        for (const g of goals) {
            const { error } = await supabase
                .from('sales_goals')
                .upsert({ year: g.year, platform: g.platform, goal_amount: g.goal_amount }, { onConflict: 'year,platform' });
            if (error) console.error('목표 저장 오류:', error);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear();
    const supabase = createSupabaseAdmin();
    const { data } = await supabase.from('sales_goals').select('*').eq('year', year);
    return NextResponse.json({ goals: data || [] });
}
