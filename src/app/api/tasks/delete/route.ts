import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();
        const supabase = createSupabaseAdmin();
        const { error } = await supabase.from('todos').delete().eq('id', id);
        if (error) return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
