import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// KPI 설정 조회
export async function GET() {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
        .from('dashboard_kpi')
        .select('*')
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || { monthly_goal: 210000000, low_stock_threshold: 20 });
}

// KPI 설정 저장
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data: existing } = await supabase.from('dashboard_kpi').select('id').maybeSingle();

    let result;
    if (existing?.id) {
        result = await supabase
            .from('dashboard_kpi')
            .update({ ...body, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .single();
    } else {
        result = await supabase
            .from('dashboard_kpi')
            .insert({ ...body })
            .select()
            .single();
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json(result.data);
}
