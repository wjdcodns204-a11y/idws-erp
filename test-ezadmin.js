// 이지어드민 재고 페이지 구조 분석
const fs = require('fs');
const puppeteer = require('puppeteer');
const LOG = 'C:/IDWS_ERP/ezadmin-stock-debug.txt';
const l = m => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

(async () => {
    fs.writeFileSync(LOG, '=== 재고 페이지 분석 ===\n');
    const b = await puppeteer.launch({
        headless: true, protocolTimeout: 120000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
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

    // 로그인
    l('로그인...');
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
    l('로그인 OK: ' + pg.url());

    // 관리자 도메인 추출
    const adminBase = pg.url().match(/(https?:\/\/[^/]+\.ezadmin\.co\.kr)/)?.[1] || 'https://ga16.ezadmin.co.kr';

    // 재고 페이지 접속
    l('재고 페이지 접속...');
    await pg.goto(`${adminBase}/template35.htm?template=I100`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    l('재고 페이지 URL: ' + pg.url());

    // 페이지 HTML 저장
    const html = await pg.content();
    fs.writeFileSync('C:/IDWS_ERP/ezadmin-stock-page.html', html);
    l('HTML 저장 (크기: ' + html.length + ')');

    // 폼 요소 분석 (검색 조건, 페이지 선택 등)
    const formInfo = await pg.evaluate(() => {
        const selects = document.querySelectorAll('select');
        const selectInfo = Array.from(selects).map(s => ({
            name: s.name, id: s.id,
            options: Array.from(s.options).map(o => o.value + ':' + o.text)
        }));
        const inputs = document.querySelectorAll('input');
        const inputInfo = Array.from(inputs).map(i => ({
            type: i.type, name: i.name, id: i.id, value: i.value
        }));
        const buttons = document.querySelectorAll('input[type="button"], input[type="submit"], button');
        const btnInfo = Array.from(buttons).map(b => ({
            text: b.value || b.textContent?.trim(), onclick: b.getAttribute('onclick')
        }));
        return { selects: selectInfo, inputs: inputInfo.slice(0, 30), buttons: btnInfo };
    });
    l('SELECT: ' + JSON.stringify(formInfo.selects, null, 1));
    l('BUTTONS: ' + JSON.stringify(formInfo.buttons, null, 1));

    // 테이블 구조 분석
    const tableInfo = await pg.evaluate(() => {
        const tables = document.querySelectorAll('table');
        return Array.from(tables).map((t, i) => {
            const rows = t.querySelectorAll('tr');
            const headers = Array.from(t.querySelectorAll('th')).map(h => h.textContent?.trim());
            return { idx: i, rows: rows.length, headers };
        });
    });
    l('TABLES: ' + JSON.stringify(tableInfo, null, 1));

    // 페이지네이션 분석
    const pagination = await pg.evaluate(() => {
        const text = document.body?.innerText || '';
        const pageMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*페이지/) || text.match(/총\s*(\d+)\s*건/);
        const pageBtns = document.querySelectorAll('a[onclick*="page"], a[onclick*="goPage"], .pagination a, .paging a');
        return {
            pageText: pageMatch ? pageMatch[0] : 'not found',
            totalPageBtns: pageBtns.length,
            bodySnippet: text.substring(0, 2000)
        };
    });
    l('PAGINATION: ' + pagination.pageText);
    l('BODY: ' + pagination.bodySnippet.replace(/\n/g, ' | ').substring(0, 800));

    await b.close();
    l('완료!');
})().catch(e => { l('FATAL: ' + e.message); process.exit(1); });
