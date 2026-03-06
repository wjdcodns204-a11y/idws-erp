// Supabase DB 테이블 현황 확인 스크립트
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xfshdibgnhhltnqzdvfp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmc2hkaWJnbmhobHRucXpkdmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5MiwiZXhwIjoyMDg2MzIxMDkyfQ.TkRi_OqW7_W7ofGdtcPtKM_S1i0zOO2zags42dZl42U',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('=== Supabase DB 테이블 현황 ===\n');

  const tables = [
    'products', 'product_variants', 'product_options',
    'inventory_locations', 'inventory_details', 'inventory_transactions',
    'warehouses', 'orders', 'order_items', 'order_status_history',
    'channels', 'settlement_ledger', 'settlements',
    'users', 'brands', 'categories',
    'employees', 'leave_requests', 'leaves',
    'attendances', 'tasks', 'task_assignees', 'task_comments', 'task_checklists',
    'role_permissions', 'reorder_requests', 'reorder_lots',
    'audit_logs', 'invitations', 'channel_sync_logs',
    'external_skus', 'channel_allocations', 'price_history',
    'notifications'
  ];

  for (const t of tables) {
    const { error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${t}: ❌ ${error.message}`);
    } else {
      console.log(`  ${t}: ✅ ${count}행`);
    }
  }

  // inventory_details 컬럼 확인
  console.log('\n=== inventory_details 샘플 (1행) ===');
  const { data: invSample } = await supabase.from('inventory_details').select('*').limit(1);
  if (invSample && invSample[0]) {
    console.log('  컬럼:', Object.keys(invSample[0]).join(', '));
  }

  // products 컬럼 확인
  console.log('\n=== products 샘플 (1행) ===');
  const { data: prodSample } = await supabase.from('products').select('*').limit(1);
  if (prodSample && prodSample[0]) {
    console.log('  컬럼:', Object.keys(prodSample[0]).join(', '));
  }

  // orders 테이블 확인
  console.log('\n=== orders 샘플 (1행) ===');
  const { data: orderSample, error: orderErr } = await supabase.from('orders').select('*').limit(1);
  if (orderErr) {
    console.log('  orders 테이블 없음:', orderErr.message);
  } else if (orderSample && orderSample[0]) {
    console.log('  컬럼:', Object.keys(orderSample[0]).join(', '));
  } else {
    console.log('  orders 테이블 있지만 데이터 없음');
  }

  // settlements 테이블 확인
  console.log('\n=== settlements 샘플 (1행) ===');
  const { data: settSample, error: settErr } = await supabase.from('settlements').select('*').limit(1);
  if (settErr) {
    console.log('  settlements 테이블 없음:', settErr.message);
  } else if (settSample && settSample[0]) {
    console.log('  컬럼:', Object.keys(settSample[0]).join(', '));
  } else {
    console.log('  settlements 테이블 있지만 데이터 없음');
  }

  // employees 테이블 확인
  console.log('\n=== employees 샘플 (1행) ===');
  const { data: empSample, error: empErr } = await supabase.from('employees').select('*').limit(1);
  if (empErr) {
    console.log('  employees 테이블 없음:', empErr.message);
  } else if (empSample && empSample[0]) {
    console.log('  컬럼:', Object.keys(empSample[0]).join(', '));
  } else {
    console.log('  employees 테이블 있지만 데이터 없음');
  }
}

main().catch(console.error);
