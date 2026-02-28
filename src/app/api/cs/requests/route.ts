import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { platform, order_number, customer_name, request_type, reason, assignee, memo } = body;

        if (!customer_name || !request_type) {
            return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { data: req, error } = await supabase
            .from('cs_requests')
            .insert({ platform, order_number, customer_name, request_type, reason, assignee, memo })
            .select()
            .single();

        if (error) return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
        return NextResponse.json({ success: true, request: req });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
