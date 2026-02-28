import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// 공지 등록 (Master = 정채운만)
export async function POST(request: Request) {
    try {
        const { title, content, importance, author_name } = await request.json();
        if (!title) return NextResponse.json({ error: '제목 필요' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { data: notice, error } = await supabase
            .from('notices')
            .insert({ title, content, importance: importance || '일반', author_name: author_name || '정채운' })
            .select().single();

        if (error) return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
        return NextResponse.json({ success: true, notice });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}

// 공지 목록 조회
export async function GET() {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase.from('notices').select('*').eq('is_active', true).order('created_at', { ascending: false });
    return NextResponse.json({ notices: data || [] });
}
