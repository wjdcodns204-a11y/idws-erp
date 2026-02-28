import { createSupabaseServer } from '@/lib/supabase';
import PurchaseOrdersClient from './PurchaseOrdersClient';

export default async function PurchaseOrdersPage() {
    const supabase = await createSupabaseServer();

    const [
        { data: orders },
        { data: suppliers },
        { data: products },
    ] = await Promise.all([
        supabase
            .from('purchase_orders')
            .select(`*, purchase_order_items(*)`)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('suppliers')
            .select('id, name, contact_name, lead_time_days')
            .order('name'),
        supabase
            .from('products')
            .select('id, name, sku')
            .eq('display_status', 'active')
            .order('name')
            .limit(200),
    ]);

    return (
        <PurchaseOrdersClient
            initialOrders={orders || []}
            suppliers={suppliers || []}
            products={products || []}
        />
    );
}
