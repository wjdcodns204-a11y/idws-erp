import { createSupabaseServer } from '@/lib/supabase';
import FinanceClient from './FinanceClient';

export default async function FinancePage() {
    const supabase = await createSupabaseServer();
    const currentMonth = new Date().toISOString().slice(0, 7); // '2026-02'

    const [
        { data: revenues },
        { data: expenses },
        { data: taxInvoices },
        { data: platformFees },
    ] = await Promise.all([
        supabase.from('revenue_records').select('*').eq('year_month', currentMonth).order('platform'),
        supabase.from('expense_records').select('*').eq('year_month', currentMonth).order('category'),
        supabase.from('tax_invoices').select('*').order('invoice_date', { ascending: false }).limit(50),
        supabase.from('platform_fees').select('platform_name, fee_pct').order('platform_name'),
    ]);

    return (
        <FinanceClient
            initialRevenues={revenues || []}
            initialExpenses={expenses || []}
            initialTaxInvoices={taxInvoices || []}
            platformFees={platformFees || []}
            currentMonth={currentMonth}
        />
    );
}
