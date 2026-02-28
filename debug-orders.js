// 이지어드민 주문 페이지 디버그 — dotenv 로드
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const DOMAIN = process.env.EZADMIN_DOMAIN || 'reto123';
    const ID = process.env.EZADMIN_ID || 'idws';
    const PW = process.env.EZADMIN_PW || '';
    console.log('[설정] domain:', DOMAIN, 'id:', ID, 'pw:', PW ? '***' : '(없음)');

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 120000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (['image', 'font', 'media'].includes(req.resourceType()) || url.startsWith('javascript:')) {
            req.abort().catch(() => { });
        } else { req.continue().catch(() => { }); }
    });

    // 로그인
    await page.goto('https://www.ezadmin.co.kr/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    await page.evaluate((domain, id, pw) => {
        const form = document.querySelector('form[name="encform"]') || document.forms[0];
        if (!form) return;
        const domainInput = form.querySelector('#domain, [name="domain"]');
        const idInput = form.querySelector('#id, [name="id"]');
        const pwInput = form.querySelector('#password, [name="password"]');
        if (domainInput) domainInput.value = domain;
        if (idInput) idInput.value = id;
        if (pwInput) pwInput.value = pw;
    }, DOMAIN, ID, PW);

    await page.evaluate(() => {
        if (typeof window.RSAloginSubmit === 'function') window.RSAloginSubmit();
        else if (typeof window.loginSubmit === 'function') window.loginSubmit();
    });

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
    await new Promise(r => setTimeout(r, 3000));
    const loginUrl = page.url();
    console.log('[1] 로그인 후 URL:', loginUrl);

    if (!loginUrl.includes('ga16')) {
        console.log('[실패] ga16으로 이동하지 않음');
        await browser.close();
        return;
    }

    // DS03 접속
    const adminBase = new URL(loginUrl).origin;
    await page.goto(`${adminBase}/template35.htm?template=DS03`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    console.log('[2] DS03 URL:', page.url());

    // 스크린샷
    if (!fs.existsSync('C:/IDWS_ERP/tmp')) fs.mkdirSync('C:/IDWS_ERP/tmp', { recursive: true });
    await page.screenshot({ path: 'C:/IDWS_ERP/tmp/ds03-page.png', fullPage: false });

    // 페이지 구조 분석
    const info = await page.evaluate(() => {
        const r = { title: document.title, buttons: [], dateInputs: [], excelElements: [], allInputButtons: [] };

        // 모든 버튼
        document.querySelectorAll('input[type="button"], input[type="submit"], button').forEach(b => {
            r.buttons.push({ value: b.value || '', text: (b.textContent || '').trim().slice(0, 60), onclick: (b.getAttribute('onclick') || '').slice(0, 120), name: b.name || '' });
        });

        // 날짜 input
        document.querySelectorAll('input[type="text"]').forEach(i => {
            const n = i.name || '', v = i.value || '';
            if (n.includes('date') || /\d{4}[-/]\d{2}[-/]\d{2}/.test(v) || n.includes('sdate') || n.includes('edate') || n.includes('period')) {
                r.dateInputs.push({ name: n, value: v, id: i.id || '' });
            }
        });

        // 엑셀 관련 요소 (넓게 검색)
        document.querySelectorAll('a, img, input[type="button"], button, span').forEach(a => {
            const text = (a.textContent || '').trim().slice(0, 60);
            const onclick = (a.getAttribute('onclick') || '').slice(0, 120);
            const alt = a.alt || '';
            const cls = (a.className || '').slice(0, 60);
            if (text.includes('엑셀') || onclick.includes('excel') || onclick.includes('xls') ||
                alt.includes('엑셀') || text.includes('Excel') || cls.includes('excel') ||
                onclick.includes('down') || text.includes('다운')) {
                r.excelElements.push({ tag: a.tagName, text, onclick, alt, cls });
            }
        });

        return r;
    });

    console.log('\n=== 페이지 분석 ===');
    console.log('Title:', info.title);
    console.log('\n--- 버튼 ---');
    info.buttons.forEach((b, i) => console.log(`  [${i}] value="${b.value}" text="${b.text}" onclick="${b.onclick}"`));
    console.log('\n--- 날짜 ---');
    info.dateInputs.forEach(d => console.log(`  name="${d.name}" value="${d.value}" id="${d.id}"`));
    console.log('\n--- 엑셀 관련 ---');
    info.excelElements.forEach(l => console.log(`  [${l.tag}] text="${l.text}" onclick="${l.onclick}" cls="${l.cls}"`));

    await browser.close();
    console.log('\n[완료]');
})();
