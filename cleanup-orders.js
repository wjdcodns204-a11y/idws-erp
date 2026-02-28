// 잘못된 주문 데이터(헤더/메타데이터 행) 제거 스크립트 v2
// 조건: 채널이 "이지어드민"이고 금액이 0원이거나, 날짜가 정상 형식(YYYY-MM-DD)이 아닌 항목 제거
const fs = require('fs');
const filePath = 'c:/IDWS_ERP/data/orders.json';

try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const before = data.orders.length;

    data.orders = data.orders.filter(o => {
        // 날짜가 YYYY-MM-DD 형식이 아니면 제거 (예: "옵션", "상품명" 같은 헤더)
        if (o.date && !/^\d{4}-\d{2}-\d{2}/.test(o.date) && !/^\d{2}\.\d{2}\.\d{2}/.test(o.date) && !/^\d{4}\//.test(o.date)) {
            return false;
        }
        // 채널이 "이지어드민"이고 금액이 0인 쓰레기 행 제거
        if (o.channel === '이지어드민' && o.totalAmount === 0 && (!o.customer || o.customer === '―')) {
            return false;
        }
        // 주문번호에 한글이 포함된 행 제거 (헤더 행: "상품명", "클센추가항목" 등)
        if (/[가-힣]/.test(o.id)) {
            return false;
        }
        return true;
    });

    const removed = before - data.orders.length;
    data.totalOrders = data.orders.length;
    data.savedAt = new Date().toISOString();

    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    console.log(`정리 완료! 전체: ${before} → ${data.orders.length} (${removed}건 제거)`);
} catch (err) {
    console.error('오류:', err.message);
}
