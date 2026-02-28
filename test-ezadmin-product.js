// 이지어드민 상품현황(GA00) 페이지 디버깅
// headless:false로 브라우저 창을 직접 띄워서 확인
const fs = require('fs');
const puppeteer = require('puppeteer');
const LOG = 'C:/IDWS_ERP/ezadmin-product-debug.txt';
const l = m => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

(async () => {
    fs.writeFileSync(LOG, '=== 상품현황 페이지(GA00) 디버깅 ===\n');
    const b = await puppeteer.launch({
        headless: false, // ← 브라우저 창 직접 보이기
        protocolTimeout: 120000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    const pg = await b.newPage();
    await pg.setRequestInterception(true);
    pg.on('request', req => {
        const t = req.resourceType();
        const u = req.url();
        if (['image', 'font', 'media'].includes(t) || u.startsWith('javascript:'))
            req.abort().catch(() => { });
        else req.continue().catch(() => { });
    });

    // ─── 로그인 ───
    l('[1/5] 로그인 시작...');
    await pg.goto('https://www.ezadmin.co.kr/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    await pg.evaluate(() => { document.querySelector('#login-popup').style.display = 'block'; });
    await new Promise(r => setTimeout(r, 500));
    await pg.type('#login-domain', 'reto123');
    await pg.type('#login-id', 'idws');
    await pg.type('#login-pwd', 'qsdew1346!');
    await pg.evaluate(() => {
        document.querySelector('#encform').action = '/login_process40.php';
        const f = document.querySelector('form[name="loginform"]');
        const p = new URLSearchParams(new FormData(f)).toString();
        document.querySelector('#encpar').value = encrypt(p);
    });
    await Promise.all([
        pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        pg.evaluate(() => document.querySelector('#encform').submit())
    ]);
    await pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
    await new Promise(r => setTimeout(r, 3000));
    l('[1/5] 로그인 결과: ' + pg.url());

    const adminBase = pg.url().match(/(https?:\/\/[^/]+\.ezadmin\.co\.kr)/)?.[1] || 'https://ga16.ezadmin.co.kr';
    l('Admin Base: ' + adminBase);

    // ─── 상품현황(GA00) 접속 ───
    l('[2/5] 상품현황(GA00) 접속...');
    await pg.goto(`${adminBase}/template35.htm?template=GA00`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    l('[2/5] GA00 URL: ' + pg.url());
    l('[2/5] GA00 Title: ' + await pg.title());

    // 페이지가 존재하지 않으면 다른 템플릿 시도
    const bodyText = await pg.evaluate(() => (document.body?.innerText || '').substring(0, 500));
    l('[2/5] Body: ' + bodyText.replace(/\n/g, ' | ').substring(0, 300));

    // GA00이 무효하면 G100, GA01 등 시도
    if (bodyText.includes('존재하지') || bodyText.includes('권한') || bodyText.includes('페이지를 찾을')) {
        l('[2/5] GA00 실패, G100 시도...');
        await pg.goto(`${adminBase}/template35.htm?template=G100`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        l('[2/5] G100 URL: ' + pg.url());
        const body2 = await pg.evaluate(() => (document.body?.innerText || '').substring(0, 500));
        l('[2/5] G100 Body: ' + body2.replace(/\n/g, ' | ').substring(0, 300));
    }

    // ─── 폼 요소 분석 ───
    l('[3/5] 폼 요소 분석...');
    const formInfo = await pg.evaluate(() => {
        const selects = document.querySelectorAll('select');
        const selectInfo = Array.from(selects).map(s => ({
            name: s.name, id: s.id,
            options: Array.from(s.options).slice(0, 10).map(o => o.value + ':' + o.text.trim())
        }));
        const buttons = document.querySelectorAll('input[type="button"], input[type="submit"], button');
        const btnInfo = Array.from(buttons).map(b => ({
            text: (b.value || b.textContent || '').trim(), onclick: (b.getAttribute('onclick') || '').substring(0, 80)
        }));
        return { selects: selectInfo, buttons: btnInfo };
    });
    l('SELECT: ' + JSON.stringify(formInfo.selects, null, 1));
    l('BUTTONS: ' + JSON.stringify(formInfo.buttons, null, 1));

    // ─── 검색 실행 ───
    l('[4/5] 검색 실행...');
    await pg.evaluate(() => {
        const w = window;
        if (typeof w.search_btn === 'function') { w.search_btn(1); return; }
        const btns = document.querySelectorAll('input[type="button"], button');
        for (const b of btns) {
            if ((b.value || b.textContent || '').includes('검색')) { b.click(); break; }
        }
    });
    await pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
    await new Promise(r => setTimeout(r, 3000));

    // ─── 테이블 분석 ───
    l('[5/5] 테이블 분석...');
    const tableInfo = await pg.evaluate(() => {
        const tables = document.querySelectorAll('table');
        return Array.from(tables).map((t, i) => {
            const rows = t.querySelectorAll('tr');
            const headers = Array.from(t.querySelectorAll('th')).map(h => (h.textContent || '').trim()).filter(h => h.length > 0 && h.length < 30);
            const firstRow = rows.length > 1 ? Array.from(rows[1].querySelectorAll('td')).map(c => (c.textContent || '').trim().substring(0, 30)) : [];
            return { idx: i, rows: rows.length, headers: headers.slice(0, 20), firstRow: firstRow.slice(0, 15) };
        }).filter(t => t.rows > 2);
    });
    l('TABLES: ' + JSON.stringify(tableInfo, null, 2));

    // HTML 저장
    const html = await pg.content();
    fs.writeFileSync('C:/IDWS_ERP/ezadmin-product-page.html', html);
    l('HTML 저장: ' + html.length + 'bytes');

    // 10초 대기 후 종료 (화면 확인 시간)
    l('10초 후 브라우저 종료...');
    await new Promise(r => setTimeout(r, 10000));
    await b.close();
    l('완료!');
})().catch(e => { l('FATAL: ' + e.message); process.exit(1); });
