// src/services/musinsa-scraper.ts
// 무신사 파트너센터 웹 스크래핑 — 상품 상태 수집
// partner.musinsa.com 로그인(OTP 포함) → 상품관리 → 테이블 파싱

import puppeteer, { Browser, Page } from 'puppeteer';

// ─── 스크래핑 결과 타입 ───
export interface MusinsaScrapedProduct {
    goodsNo: string;
    goodsName: string;
    styleCode: string;
    status: string;
    store: string;
    price: number;
}

// ─── 브라우저 관리 ───
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (browserInstance && browserInstance.connected) return browserInstance;
    browserInstance = await puppeteer.launch({
        headless: false,  // 실제 브라우저 창 — 봇 감지 회피
        protocolTimeout: 120000,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
            '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
        ],
    });
    return browserInstance;
}

export async function closeBrowser(): Promise<void> {
    if (browserInstance) { await browserInstance.close(); browserInstance = null; }
}

// ─── 로그인 (ID/PW + OTP 2차 인증) ───
async function login(page: Page, userId: string, userPw: string, otpCode: string): Promise<boolean> {
    try {
        // 이미지/폰트 차단
        await page.setRequestInterception(true);
        page.on('request', req => {
            const t = req.resourceType();
            if (['image', 'font', 'media'].includes(t)) {
                req.abort().catch(() => { });
            } else {
                req.continue().catch(() => { });
            }
        });

        // 루트 URL로 접속 (SPA가 자동으로 로그인 화면으로 리다이렉트)
        // /login 경로는 React Router에서 404 발생하므로 루트 사용
        await page.goto('https://partner.musinsa.com', {
            waitUntil: 'networkidle2', timeout: 30000,
        });

        // React SPA가 완전히 렌더링될 때까지 대기 (input 태그가 나올 때까지)
        console.log('[무신사] React 앱 렌더링 대기...');
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const inputCount = await page.evaluate(() => document.querySelectorAll('input').length);
            if (inputCount >= 2) {
                console.log(`[무신사] 로그인 폼 렌더링 완료 (input ${inputCount}개, ${(i + 1) * 2}초 후)`);
                break;
            }
            if (i === 9) console.log(`[무신사] 경고: 20초 후에도 input이 ${inputCount}개`);
        }

        // 디버깅: 페이지 상태
        const pageState = await page.evaluate(() => ({
            url: window.location.href,
            inputCount: document.querySelectorAll('input').length,
            buttonCount: document.querySelectorAll('button').length,
            bodySnippet: (document.body?.innerText || '').substring(0, 300),
        }));
        console.log('[무신사] 페이지:', JSON.stringify(pageState));

        // 2) ID/PW 입력 — 모든 input을 순회하며 찾기
        const allInputs = await page.$$('input');
        let idFilled = false, pwFilled = false;

        for (const input of allInputs) {
            const attrs = await input.evaluate(el => ({
                type: el.getAttribute('type') || '',
                name: el.getAttribute('name') || '',
                placeholder: el.getAttribute('placeholder') || '',
            }));

            if (!idFilled && (attrs.type === 'text' || attrs.type === 'email' || attrs.type === '' ||
                attrs.name.includes('id') || attrs.name.includes('user') ||
                attrs.placeholder.includes('아이디') || attrs.placeholder.includes('ID'))) {
                await input.click({ clickCount: 3 });
                await input.type(userId, { delay: 50 });
                idFilled = true;
                console.log(`[무신사] ID 입력 완료 (${attrs.type}/${attrs.name})`);
            } else if (!pwFilled && (attrs.type === 'password' ||
                attrs.name.includes('pw') || attrs.name.includes('pass'))) {
                await input.click({ clickCount: 3 });
                await input.type(userPw, { delay: 50 });
                pwFilled = true;
                console.log(`[무신사] PW 입력 완료 (${attrs.type}/${attrs.name})`);
            }
        }

        if (!idFilled || !pwFilled) {
            console.error(`[무신사] 폼 입력 실패 — ID:${idFilled} PW:${pwFilled}`);
            return false;
        }

        // 3) "로그인" 버튼 클릭
        const clicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of Array.from(buttons)) {
                const text = (btn.textContent || '').trim();
                if (text === '로그인' || text === 'Login') {
                    btn.click();
                    return true;
                }
            }
            const submit = document.querySelector('button[type="submit"]') as HTMLElement;
            if (submit) { submit.click(); return true; }
            return false;
        });
        if (!clicked) { console.error('[무신사] 로그인 버튼 못 찾음'); return false; }
        console.log('[무신사] 로그인 버튼 클릭');

        // 4) 2차 인증(OTP) 화면 대기
        await new Promise(r => setTimeout(r, 5000));

        const afterLogin = await page.evaluate(() => ({
            url: window.location.href,
            bodyText: (document.body?.innerText || '').substring(0, 300),
        }));
        console.log('[무신사] 로그인 후:', afterLogin.url);

        // 5) OTP 입력 — "인증 코드 입력" placeholder 필드
        if (otpCode) {
            console.log('[무신사] OTP 입력 시도...');

            const otpInput = await page.$('input[placeholder*="인증 코드"]')
                || await page.$('input[placeholder*="인증"]')
                || await page.$('input[placeholder*="코드"]')
                || await page.$('input[maxlength="6"]')
                || await page.$('input[type="number"]')
                || await page.$('input[type="tel"]');

            if (otpInput) {
                await otpInput.click({ clickCount: 3 });
                await otpInput.type(otpCode, { delay: 80 });
                console.log('[무신사] OTP 코드 입력 완료');
            } else {
                // 못 찾으면 마지막 input 사용
                const inputs = await page.$$('input');
                if (inputs.length > 0) {
                    const last = inputs[inputs.length - 1];
                    await last.click({ clickCount: 3 });
                    await last.type(otpCode, { delay: 80 });
                    console.log('[무신사] OTP (마지막 input)');
                }
            }

            await new Promise(r => setTimeout(r, 1000));

            // "인증하기" 버튼 클릭
            const authClicked = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of Array.from(buttons)) {
                    const text = (btn.textContent || '').trim();
                    if (text === '인증하기' || text === '확인' || text === '인증') {
                        btn.click();
                        return text;
                    }
                }
                const submit = document.querySelector('button[type="submit"]') as HTMLElement;
                if (submit) { submit.click(); return 'submit'; }
                return null;
            });
            console.log(`[무신사] 인증 버튼: ${authClicked}`);

            await new Promise(r => setTimeout(r, 5000));
        }

        const finalUrl = page.url();
        const isLoggedIn = !finalUrl.includes('/login') && !finalUrl.includes('/auth');
        console.log(`[무신사] 최종: ${isLoggedIn ? '로그인 성공' : '로그인 실패'} — ${finalUrl}`);
        return isLoggedIn;
    } catch (error) {
        console.error('[무신사] 로그인 오류:', error);
        return false;
    }
}

// ─── 상품 상태 스크래핑 ───
export async function scrapeProductStatus(otpCode: string): Promise<{
    success: boolean;
    data: MusinsaScrapedProduct[];
    error?: string;
    debugInfo?: string;
}> {
    // 환경변수를 호출 시점에 읽음 (서버 재시작 없이도 반영)
    const userId = process.env.MUSINSA_PARTNER_ID || '';
    const userPw = process.env.MUSINSA_PARTNER_PW || '';

    if (!userId || !userPw) {
        return {
            success: false, data: [],
            error: '무신사 ID/PW가 설정되지 않았습니다.\n.env에 MUSINSA_PARTNER_ID / MUSINSA_PARTNER_PW 입력 필요.',
        };
    }
    if (!otpCode || otpCode.length !== 6) {
        return { success: false, data: [], error: 'OTP 코드(6자리)를 입력해 주세요.' };
    }

    console.log(`[무신사] 스크래핑 시작 — ID: ${userId.substring(0, 5)}...`);

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        const loggedIn = await login(page, userId, userPw, otpCode);
        if (!loggedIn) {
            const bodyText = await page.evaluate(() => (document.body?.innerText || '').substring(0, 300));
            return {
                success: false, data: [],
                error: '로그인 실패. ID/PW 또는 OTP를 확인해 주세요.',
                debugInfo: `URL: ${page.url()}\n${bodyText}`,
            };
        }

        // ─── 상품관리 페이지 이동 ───
        // 직접 URL 접속은 SPA가 대시보드로 리다이렉트함
        // 대시보드에서 a[href*="/goods/manage"] 링크를 내부 클릭해야 함
        console.log('[무신사] 대시보드에서 상품관리 링크 찾기...');
        await new Promise(r => setTimeout(r, 3000));

        // 대시보드 내 href로 상품관리 링크 클릭
        const navResult = await page.evaluate(() => {
            // 1순위: href에 /goods/manage가 포함된 <a> 태그
            const links = document.querySelectorAll('a[href*="/goods/manage"]');
            if (links.length > 0) {
                (links[0] as HTMLElement).click();
                return { method: 'href', href: links[0].getAttribute('href'), count: links.length };
            }
            // 2순위: href에 /goods가 포함된 <a> 태그
            const links2 = document.querySelectorAll('a[href*="/goods"]');
            if (links2.length > 0) {
                (links2[0] as HTMLElement).click();
                return { method: 'goods-href', href: links2[0].getAttribute('href'), count: links2.length };
            }
            // 3순위: "상품관리" 텍스트가 포함된 <a> (가장 짧은 것)
            let best: HTMLElement | null = null;
            let bestLen = 999;
            document.querySelectorAll('a').forEach(a => {
                const t = (a.textContent || '').trim();
                if (t.includes('상품') && t.includes('관리') && t.length < bestLen) {
                    best = a as HTMLElement;
                    bestLen = t.length;
                }
            });
            if (best) { (best as HTMLElement).click(); return { method: 'text', href: (best as HTMLAnchorElement).getAttribute('href'), count: 1 }; }
            return null;
        });
        console.log(`[무신사] 상품관리 이동:`, JSON.stringify(navResult));

        // 페이지 전환 대기
        await new Promise(r => setTimeout(r, 5000));
        console.log(`[무신사] 현재 URL: ${page.url()}`);

        // 검색 버튼 렌더링 대기 (최대 20초)
        console.log('[무신사] 검색 버튼 렌더링 대기...');
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const btnInfo = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const texts = btns.map(b => (b.textContent || '').trim().substring(0, 15));
                return { total: btns.length, texts, searchFound: texts.includes('검색') };
            });
            console.log(`[무신사] 대기 ${(i + 1) * 2}초: 버튼 ${btnInfo.total}개 [${btnInfo.texts.join(', ')}]`);
            if (btnInfo.searchFound) {
                console.log('[무신사] 검색 버튼 발견!');
                break;
            }
        }

        // "검색" 버튼 클릭
        const searchClicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of Array.from(buttons)) {
                if ((btn.textContent || '').trim() === '검색') {
                    (btn as HTMLElement).click();
                    return true;
                }
            }
            return false;
        });
        console.log(`[무신사] 검색 버튼 클릭: ${searchClicked}`);

        // 상품 테이블이 로딩될 때까지 대기 (최대 30초)
        console.log('[무신사] 상품 테이블 로딩 대기...');
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const check = await page.evaluate(() => ({
                tables: document.querySelectorAll('table').length,
                trs: document.querySelectorAll('tbody tr').length,
                tds: document.querySelectorAll('td').length,
            }));
            console.log(`[무신사] 대기 ${(i + 1) * 2}초: table=${check.tables} tr=${check.trs} td=${check.tds}`);
            if (check.trs > 3) {
                console.log(`[무신사] 상품 테이블 로딩 완료! (${(i + 1) * 2}초 후)`);
                break;
            }
        }

        const pageInfo = await page.evaluate(() => ({
            url: window.location.href,
            tableCount: document.querySelectorAll('table').length,
            trCount: document.querySelectorAll('tbody tr').length,
            thTexts: Array.from(document.querySelectorAll('th')).map(th => (th.textContent || '').trim()).join(' | '),
            bodySnippet: (document.body?.innerText || '').substring(0, 500),
        }));
        console.log(`[무신사] 테이블: ${pageInfo.tableCount}개, 데이터행: ${pageInfo.trCount}개`);
        console.log(`[무신사] 헤더: ${pageInfo.thTexts}`);
        console.log(`[무신사] URL: ${pageInfo.url}`);

        // 상품 데이터 추출
        const products = await page.evaluate(() => {
            const results: Array<{
                goodsNo: string; goodsName: string; styleCode: string;
                status: string; store: string; price: number;
            }> = [];

            // 테이블 파싱
            const tables = document.querySelectorAll('table');
            for (const table of Array.from(tables)) {
                const headers: string[] = [];
                table.querySelectorAll('th').forEach(th => headers.push((th.textContent || '').trim()));

                const rows = table.querySelectorAll('tbody tr');
                for (const row of Array.from(rows)) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) continue;
                    const d: Record<string, string> = {};
                    cells.forEach((c, i) => { d[headers[i] || `col${i}`] = (c.textContent || '').trim(); });

                    const goodsNo = d['상품번호'] || d['상품코드'] || d['No'] || '';
                    const goodsName = d['상품명'] || d['상품'] || '';
                    const styleCode = d['품번'] || d['스타일코드'] || d['업체상품코드'] || '';
                    const status = d['상태'] || d['판매상태'] || '';
                    const priceStr = d['판매가'] || d['가격'] || '0';

                    if (goodsNo || goodsName) {
                        results.push({
                            goodsNo, goodsName, styleCode,
                            status: status || '알수없음', store: 'normal',
                            price: parseInt(priceStr.replace(/[^0-9]/g, '')) || 0,
                        });
                    }
                }
            }

            // React 리스트 파싱 (테이블이 없을 때)
            if (results.length === 0) {
                const items = document.querySelectorAll('[class*="product"], [class*="goods"], [class*="item"], tr[data-id]');
                for (const item of Array.from(items)) {
                    const text = (item.textContent || '').trim();
                    if (text.length < 10) continue;
                    let status = '알수없음';
                    if (text.includes('판매중')) status = '판매중';
                    else if (text.includes('품절')) status = '품절';
                    else if (text.includes('판매중지')) status = '판매중지';
                    else if (text.includes('검수반려')) status = '검수반려';
                    results.push({
                        goodsNo: '', goodsName: text.substring(0, 100), styleCode: '',
                        status, store: text.includes('아울렛') ? 'outlet' : 'normal', price: 0,
                    });
                }
            }
            return results;
        });

        console.log(`[무신사] 상품 ${products.length}건 수집`);
        return { success: true, data: products, debugInfo: pageInfo.bodySnippet };
    } catch (error) {
        console.error('[무신사] 오류:', error);
        return { success: false, data: [], error: error instanceof Error ? error.message : '스크래핑 실패' };
    } finally {
        await page.close();
    }
}
