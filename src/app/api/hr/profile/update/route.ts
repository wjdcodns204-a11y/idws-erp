import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// 파일 업로드 + 인사 정보 저장을 한번에 처리하는 API
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const rawData = formData.get('data') as string;
        const file = formData.get('file') as File | null;

        if (!id || !rawData) {
            return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
        }

        const data = JSON.parse(rawData);
        const supabase = createSupabaseAdmin();

        let contractFileUrl = data.contract_file_url || null;

        // 파일이 있다면 Supabase Storage에 업로드
        if (file && file.size > 0) {
            const fileExt = file.name.split('.').pop();
            const fileName = `hr-contracts/${id}/${Date.now()}.${fileExt}`;
            const fileBuffer = await file.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('hr-files')
                .upload(fileName, fileBytes, {
                    contentType: file.type,
                    upsert: true
                });

            if (uploadError) {
                console.error('파일 업로드 실패:', uploadError);
                // 파일 업로드 반드시 성공 필요 없으면 에러 무시 후 계속 진행
            } else if (uploadData) {
                const { data: publicUrlData } = supabase
                    .storage
                    .from('hr-files')
                    .getPublicUrl(uploadData.path);
                contractFileUrl = publicUrlData?.publicUrl || null;
            }
        }

        // employees 테이블 업데이트
        const { error: updateError } = await supabase
            .from('employees')
            .update({
                department: data.department,
                hire_date: data.hire_date,
                phone_number: data.phone_number,
                birth_date: data.birth_date,
                employee_status: data.employee_status,
                base_salary: data.base_salary,
                role: data.role,
                contract_drive_link: data.contract_drive_link,
                contract_file_url: contractFileUrl,
            })
            .eq('id', id);

        if (updateError) {
            console.error('직원 정보 업데이트 실패:', updateError);
            return NextResponse.json({ error: 'DB 저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, contract_file_url: contractFileUrl });

    } catch (error: unknown) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
    }
}
