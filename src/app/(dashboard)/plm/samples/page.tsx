import { createSupabaseServer } from '@/lib/supabase';
import PlmEnhancedClient from './PlmEnhancedClient';

export default async function PlmEnhancedPage() {
    const supabase = await createSupabaseServer();
    const [
        { data: samples },
        { data: fabricSuppliers },
        { data: sizeSpecs },
    ] = await Promise.all([
        supabase.from('samples').select('*').order('created_at', { ascending: false }),
        supabase.from('fabric_suppliers').select('*').eq('is_active', true).order('name'),
        supabase.from('size_specs').select('*').order('product_name'),
    ]);

    return (
        <PlmEnhancedClient
            initialSamples={samples || []}
            initialFabricSuppliers={fabricSuppliers || []}
            initialSizeSpecs={sizeSpecs || []}
        />
    );
}
