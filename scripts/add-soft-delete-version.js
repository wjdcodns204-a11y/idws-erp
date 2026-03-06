// DB 테이블에 소프트 삭제(deleted_at)와 버전 관리(version) 컬럼 추가
// 비유: 전산 시스템에 "삭제 표시란"과 "수정 번호란"을 추가하는 것
// - deleted_at: 데이터를 실제로 지우지 않고 "숨김 처리"하는 날짜 (null이면 정상)
// - version: 두 사람이 동시에 같은 데이터를 수정할 때 충돌을 방지하는 번호

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xfshdibgnhhltnqzdvfp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmc2hkaWJnbmhobHRucXpkdmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5MiwiZXhwIjoyMDg2MzIxMDkyfQ.TkRi_OqW7_W7ofGdtcPtKM_S1i0zOO2zags42dZl42U',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runSQL(sql, label) {
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // rpc가 없으면 REST API로 직접 실행 불가 — Supabase Dashboard에서 실행 필요
    console.log(`  ⚠️ ${label}: RPC 미지원 — Dashboard에서 수동 실행 필요`);
    console.log(`     SQL: ${sql}`);
    return false;
  }
  console.log(`  ✅ ${label}`);
  return true;
}

async function main() {
  console.log('=== 소프트 삭제 + 버전 관리 컬럼 추가 ===\n');

  // 주요 테이블에 deleted_at, version 추가
  const alterStatements = [
    // products 테이블
    { sql: "ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "products.deleted_at" },
    { sql: "ALTER TABLE products ADD COLUMN IF NOT EXISTS version INT DEFAULT 1", label: "products.version" },

    // orders 테이블
    { sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "orders.deleted_at" },
    { sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INT DEFAULT 1", label: "orders.version" },

    // inventory_details 테이블
    { sql: "ALTER TABLE inventory_details ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "inventory_details.deleted_at" },
    { sql: "ALTER TABLE inventory_details ADD COLUMN IF NOT EXISTS version INT DEFAULT 1", label: "inventory_details.version" },

    // employees 테이블
    { sql: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "employees.deleted_at" },

    // tasks 테이블
    { sql: "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "tasks.deleted_at" },

    // leaves 테이블
    { sql: "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "leaves.deleted_at" },

    // settlements 테이블
    { sql: "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL", label: "settlements.deleted_at" },

    // created_at 인덱스 (3년 보관 정책용)
    { sql: "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)", label: "orders.created_at 인덱스" },
    { sql: "CREATE INDEX IF NOT EXISTS idx_leaves_created_at ON leaves(created_at)", label: "leaves.created_at 인덱스" },
  ];

  let rpcAvailable = true;
  for (const stmt of alterStatements) {
    if (!rpcAvailable) {
      console.log(`  📋 ${stmt.label}: ${stmt.sql}`);
      continue;
    }
    const ok = await runSQL(stmt.sql, stmt.label);
    if (!ok) {
      rpcAvailable = false;
      console.log('\n⚠️ RPC가 지원되지 않습니다. 아래 SQL을 Supabase Dashboard > SQL Editor에서 실행해주세요:\n');
      // 나머지 SQL 출력
      for (const s of alterStatements) {
        console.log(s.sql + ';');
      }
      break;
    }
  }
}

main().catch(console.error);
