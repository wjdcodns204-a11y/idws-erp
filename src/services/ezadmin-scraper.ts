// src/services/ezadmin-scraper.ts
// 이지어드민 웹 스크래핑 서비스 — 검증된 RSA 로그인 방식
// 접속 → RSA 암호화 → encform submit → 관리자 대시보드(ga16.ezadmin.co.kr)

import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';

// ─── 환경변수 ───
const EZADMIN_DOMAIN = process.env.EZADMIN_DOMAIN || 'reto123';
const EZADMIN_ID = process.env.EZADMIN_ID || 'idws';
const EZADMIN_PW = process.env.EZADMIN_PW || '';

// ─── 브라우저 관리 ───
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (browserInstance && browserInstance.connected) return browserInstance;
    browserInstance = await puppeteer.launch({
        headless: true,
        protocolTimeout: 120000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    return browserInstance;
}

export async function closeBrowser(): Promise<void> {
    if (browserInstance) { await browserInstance.close(); browserInstance = null; }
}

// ─── 로그인 (검증 완료 방식) ───
async function login(page: Page): Promise<boolean> {
    try {
        // 이미지/폰트 차단으로 빠른 로딩
        await page.setRequestInterception(true);
        page.on('request', req => {
            const t = req.resourceType();
            const url = req.url();
            // 이미지/폰트/미디어 및 javascript: URL 차단
            if (['image', 'font', 'media'].includes(t) || url.startsWith('javascript:')) {
                req.abort().catch(() => { });
            } else {
                req.continue().catch(() => { });
            }
        });

        await page.goto('https://www.ezadmin.co.kr/index.html', {
            waitUntil: 'domcontentloaded', timeout: 30000,
        });

        // RSA 등 JS 로드 대기
        await new Promise(r => setTimeout(r, 5000));

        // 로그인 팝업 강제 표시
        await page.evaluate(() => {
            const popup = document.querySelector('#login-popup') as HTMLElement;
            if (popup) popup.style.display = 'block';
        });
        await new Promise(r => setTimeout(r, 500));

        // 폼 입력
        await page.type('#login-domain', EZADMIN_DOMAIN);
        await page.type('#login-id', EZADMIN_ID);
        await page.type('#login-pwd', EZADMIN_PW);

        // RSA 암호화 + encform 제출
        await page.evaluate(() => {
            const encform = document.querySelector('#encform') as HTMLFormElement;
            encform.action = '/login_process40.php';
            const loginform = document.querySelector('form[name="loginform"]') as HTMLFormElement;
            const params = new URLSearchParams(new FormData(loginform) as unknown as Record<string, string>).toString();
            const encrypted = (window as unknown as { encrypt: (d: string) => string }).encrypt(params);
            (document.querySelector('#encpar') as HTMLInputElement).value = encrypted;
        });

        // 제출 + 네비게이션 대기
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            page.evaluate(() => (document.querySelector('#encform') as HTMLFormElement).submit()),
        ]);

        // 추가 리다이렉트 대기
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));

        const url = page.url();
        const isLoggedIn = url.includes('ezadmin.co.kr') && !url.includes('index.html');
        console.log(`[이지어드민] 로그인 ${isLoggedIn ? '성공' : '실패'}: ${url}`);
        return isLoggedIn;
    } catch (error) {
        console.error('[이지어드민] 로그인 오류:', error);
        return false;
    }
}

// ─── 관리자 URL 추출 (대시보드에서 ga16 도메인 찾기) ───
function getAdminBase(url: string): string {
    const match = url.match(/(https?:\/\/[^/]+\.ezadmin\.co\.kr)/);
    return match ? match[1] : 'https://ga16.ezadmin.co.kr';
}

// ─── 타입 정의 ───
export interface EzadminStockItem {
    [key: string]: string | number;
}

export interface EzadminOrder {
    [key: string]: string | number;
}

// ─── 상품 상태 스크래핑 (이지어드민 → 무신사 상품 판매상태) ───
// 이지어드민의 상품현황 페이지(GA00)에서 상품별 판매상태를 가져옴
// 판매상태: 판매중, 품절, 판매중지, 검수반려, 검수중, 임시저장 등
export async function scrapeProductStatus(): Promise<{
    success: boolean;
    data: Array<{
        goodsNo: string;      // 상품코드 (무신사 상품번호)
        goodsName: string;    // 상품명
        styleCode: string;    // 품번
        status: string;       // 판매상태
        store: string;        // 채널 (normal/outlet)
        sellingPrice: number; // 판매가
        tagPrice: number;     // 정상가
    }>;
    error?: string;
    currentUrl?: string;
}> {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        const loggedIn = await login(page);
        if (!loggedIn) return { success: false, data: [], error: '이지어드민 로그인 실패' };

        const adminBase = getAdminBase(page.url());

        // 1) 상품현황 페이지(GA00) 접속
        console.log('[상품상태] 이지어드민 상품현황 페이지 접속...');
        await page.goto(`${adminBase}/template35.htm?template=GA00`, {
            waitUntil: 'domcontentloaded', timeout: 15000,
        });
        await new Promise(r => setTimeout(r, 3000));

        // 2) 쇼핑몰 필터를 '무신사'로 설정 (가능한 경우)
        await page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            for (const sel of Array.from(selects)) {
                const opts = Array.from(sel.options);
                // 쇼핑몰 선택 셀렉트 찾기 (옵션에 '무신사'가 있는 셀렉트)
                const musinsaOpt = opts.find(o =>
                    o.text.includes('무신사') || o.value.includes('musinsa')
                );
                if (musinsaOpt) {
                    sel.value = musinsaOpt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 500));

        // 3) 표시 수를 500개로 설정 (최대)
        await page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            for (const sel of Array.from(selects)) {
                const opts = Array.from(sel.options).map(o => o.value);
                if (opts.includes('500')) {
                    sel.value = '500';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 500));

        // 4) 검색 실행
        await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            if (typeof w['search_btn'] === 'function') {
                (w['search_btn'] as (n: number) => void)(1);
                return;
            }
            const btns = document.querySelectorAll('input[type="button"], input[type="submit"], button, a');
            for (const btn of Array.from(btns)) {
                const val = (btn as HTMLInputElement).value || btn.textContent || '';
                const onclick = btn.getAttribute('onclick') || '';
                if (val.trim() === '검색' || val.trim() === '검색하기' || onclick.includes('search')) {
                    (btn as HTMLElement).click(); break;
                }
            }
        });
        // 이지어드민은 프레임 또는 Ajax로 테이블 갱신될 수 있어 waitForNavigation이 타임아웃을 유발할 수 있음.
        // 고정 대기(5초)로 테이블 렌더링을 기다림.
        await new Promise(r => setTimeout(r, 5000));

        // 5) 테이블에서 상품 상태 데이터 추출
        const allData: Array<{
            goodsNo: string; goodsName: string; styleCode: string;
            status: string; store: string; sellingPrice: number; tagPrice: number;
        }> = [];

        const extractProductTable = async () => {
            return page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                let productTable: HTMLTableElement | null = null;

                // 테이블 헤더에 '상품코드' 또는 '상품명' 또는 '판매상태'가 있는 테이블 찾기
                for (const t of Array.from(tables)) {
                    const ths = t.querySelectorAll('th');
                    const headerTexts = Array.from(ths).map(th => (th.textContent || '').trim());
                    if (headerTexts.some(h => h.includes('상품코드') || h.includes('상품번호')) &&
                        headerTexts.some(h => h.includes('상품명') || h.includes('판매상태') || h.includes('상태'))) {
                        productTable = t as HTMLTableElement;
                        break;
                    }
                }

                // 없으면 가장 행이 많은 테이블 사용
                if (!productTable) {
                    let maxRows = 0;
                    for (const t of Array.from(tables)) {
                        const rows = t.querySelectorAll('tr');
                        if (rows.length > maxRows) {
                            maxRows = rows.length;
                            productTable = t as HTMLTableElement;
                        }
                    }
                }

                if (!productTable) return { headers: [] as string[], items: [] as Record<string, string>[] };

                // 헤더 추출
                const headers: string[] = [];
                productTable.querySelectorAll('th').forEach(th => {
                    const text = (th.textContent || '').trim().replace(/\s+/g, ' ');
                    if (text && text.length < 30) headers.push(text);
                });

                // 데이터 행 추출
                const items: Record<string, string>[] = [];
                const allRows = productTable.querySelectorAll('tbody tr');
                const targetRows = allRows.length > 0 ? allRows : productTable.querySelectorAll('tr');

                for (const row of Array.from(targetRows)) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) continue;

                    const item: Record<string, string> = {};
                    let cellIdx = 0;
                    cells.forEach(cell => {
                        const key = headers[cellIdx] || `col${cellIdx}`;
                        item[key] = (cell.textContent || '').trim();
                        cellIdx++;
                    });
                    if (Object.keys(item).length > 0) items.push(item);
                }

                return { headers, items };
            });
        };

        // 첫 페이지 데이터 수집
        const firstPage = await extractProductTable();
        console.log(`[상품상태] 헤더: ${firstPage.headers.join(', ')}`);
        console.log(`[상품상태] 첫 페이지: ${firstPage.items.length}건`);

        // 헤더 컬럼 이름 매핑 (이지어드민의 헤더명은 다양할 수 있음)
        const findKey = (headers: string[], ...keywords: string[]): string => {
            return headers.find(h => keywords.some(k => h.includes(k))) || '';
        };

        const codeKey = findKey(firstPage.headers, '상품코드', '상품번호', '코드');
        const nameKey = findKey(firstPage.headers, '상품명');
        const statusKey = findKey(firstPage.headers, '판매상태', '상태', '판매');
        const styleKey = findKey(firstPage.headers, '품번', '스타일코드', '자체코드', '모델명');
        const priceKey = findKey(firstPage.headers, '판매가', '판매단가');
        const normalPriceKey = findKey(firstPage.headers, '정상가', '소비자가', '정가');
        const channelKey = findKey(firstPage.headers, '쇼핑몰', '채널', '판매채널');

        // 데이터 변환
        const convertRow = (row: Record<string, string>) => {
            const code = String(row[codeKey] || '').trim();
            const name = String(row[nameKey] || '').trim();
            const rawStatus = String(row[statusKey] || '').trim();
            const styleCode = String(row[styleKey] || '').trim();
            const channel = String(row[channelKey] || '').trim().toLowerCase();
            const sellingPrice = parseInt(String(row[priceKey] || '0').replace(/[^0-9]/g, '')) || 0;
            const tagPrice = parseInt(String(row[normalPriceKey] || '0').replace(/[^0-9]/g, '')) || 0;

            // 판매상태 정규화
            let status = '판매중';
            if (rawStatus.includes('품절')) status = '품절';
            else if (rawStatus.includes('중지') || rawStatus.includes('일시')) status = '판매중지';
            else if (rawStatus.includes('반려')) status = '검수반려';
            else if (rawStatus.includes('검수')) status = '검수중';
            else if (rawStatus.includes('임시')) status = '임시저장';
            else if (rawStatus.includes('삭제')) status = '삭제';
            else if (rawStatus.includes('판매') || rawStatus.includes('진행')) status = '판매중';

            return {
                goodsNo: code,
                goodsName: name,
                styleCode,
                status,
                store: channel.includes('아울렛') || channel.includes('outlet') ? 'outlet' : 'normal',
                sellingPrice,
                tagPrice,
            };
        };

        for (const row of firstPage.items) {
            const converted = convertRow(row);
            if (converted.goodsNo || converted.goodsName) {
                allData.push(converted);
            }
        }

        // 페이지네이션 — 다음 페이지가 있으면 계속 수집
        let pageNum = 2;
        while (pageNum <= 20) {
            const hasNext = await page.evaluate((pn: number) => {
                const links = document.querySelectorAll('a');
                for (const link of Array.from(links)) {
                    const onclick = link.getAttribute('onclick') || '';
                    const text = (link.textContent || '').trim();
                    if ((onclick.includes('search_btn') && onclick.includes(`(${pn})`)) ||
                        text === String(pn)) {
                        (link as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            }, pageNum);
            if (!hasNext) break;

            // 페이지 이동 대기 
            await new Promise(r => setTimeout(r, 3000));

            const nextPage = await extractProductTable();
            if (nextPage.items.length === 0) break;

            for (const row of nextPage.items) {
                const converted = convertRow(row);
                if (converted.goodsNo || converted.goodsName) {
                    allData.push(converted);
                }
            }
            console.log(`[상품상태] 페이지${pageNum}: +${nextPage.items.length}건 (누적: ${allData.length}건)`);
            pageNum++;
        }

        console.log(`[상품상태] 완료: 총 ${allData.length}건 상품 상태 수집`);
        return { success: true, data: allData, currentUrl: page.url() };
    } catch (error) {
        console.error('[상품상태] 에러:', error);
        return { success: false, data: [], error: error instanceof Error ? error.message : '상품 상태 스크래핑 실패' };
    } finally {
        await page.close();
    }
}

// ─── 재고 현황 스크래핑 (전체 상품) ───
export async function scrapeStock(): Promise<{ success: boolean; data: EzadminStockItem[]; error?: string; currentUrl?: string; totalCount?: number }> {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        const loggedIn = await login(page);
        if (!loggedIn) return { success: false, data: [], error: '로그인 실패' };

        const adminBase = getAdminBase(page.url());

        // 1) 재고조회 페이지(I100) 접속
        await page.goto(`${adminBase}/template35.htm?template=I100`, {
            waitUntil: 'domcontentloaded', timeout: 15000,
        });
        await new Promise(r => setTimeout(r, 3000));

        // 2) 표시 수를 500개로 설정 (최대)
        await page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            for (const sel of Array.from(selects)) {
                const opts = Array.from(sel.options).map(o => o.value);
                if (opts.includes('500')) {
                    sel.value = '500';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 500));

        // 3) 검색 실행
        await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            if (typeof w['search_btn'] === 'function') {
                (w['search_btn'] as (n: number) => void)(1);
                return;
            }
            const btns = document.querySelectorAll('input[type="button"], input[type="submit"], button, a');
            for (const btn of Array.from(btns)) {
                const val = (btn as HTMLInputElement).value || btn.textContent || '';
                const onclick = btn.getAttribute('onclick') || '';
                if (val.trim() === '검색' || onclick.includes('search')) {
                    (btn as HTMLElement).click(); break;
                }
            }
        });

        // 검색 결과 로딩 대기 
        await new Promise(r => setTimeout(r, 5000));

        // 4) 전체 데이터 수집 (페이지네이션 포함)
        const allData: EzadminStockItem[] = [];
        const firstPage = await extractStockTable(page);
        allData.push(...firstPage);

        // 다음 페이지가 있으면 계속 수집
        let pageNum = 2;
        while (pageNum <= 20) {
            const hasNext = await page.evaluate((pn: number) => {
                const links = document.querySelectorAll('a');
                for (const link of Array.from(links)) {
                    const onclick = link.getAttribute('onclick') || '';
                    if (onclick.includes('search_btn') && onclick.includes(`(${pn})`)) {
                        (link as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            }, pageNum);
            if (!hasNext) break;

            // 페이지 이동 대기
            await new Promise(r => setTimeout(r, 3000));

            const nextData = await extractStockTable(page);
            if (nextData.length === 0) break;
            allData.push(...nextData);
            pageNum++;
        }

        return { success: true, data: allData, currentUrl: page.url(), totalCount: allData.length };
    } catch (error) {
        return { success: false, data: [], error: error instanceof Error ? error.message : '재고 스크래핑 실패' };
    } finally {
        await page.close();
    }
}

// ─── 주문 수집 (이지어드민 다운로드 관리자 방식) ───
// 확장주문검색2(DS03) → 검색 → 대 다운로드 → 모달 처리 → 다운로드관리자에서 파일 받기
export async function scrapeOrders(): Promise<{ success: boolean; data: EzadminOrder[]; error?: string; currentUrl?: string; totalCount?: number }> {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // 다운로드 폴더 설정
    const downloadPath = path.join(process.cwd(), 'tmp', 'ezadmin-downloads');
    await fs.mkdir(downloadPath, { recursive: true });

    try {
        const loggedIn = await login(page);
        if (!loggedIn) return { success: false, data: [], error: '로그인 실패' };

        const adminBase = getAdminBase(page.url());

        // CDP 세션으로 다운로드 허용
        const client = await page.createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        // ── STEP 1: 확장주문검색2(DS03) 페이지 접속 ──
        console.log('[주문수집] Step1: DS03 페이지 접속');
        await page.goto(`${adminBase}/template35.htm?template=DS03`, {
            waitUntil: 'domcontentloaded', timeout: 15000,
        });
        await new Promise(r => setTimeout(r, 3000));

        // ── STEP 2: 날짜 설정 (기본 날짜 그대로 사용 — 이미 설정되어 있음) ──
        // 스크린샷에서 확인: 이지어드민은 2개월 범위로 기본 설정되어 있음
        console.log('[주문수집] Step2: 날짜 설정 확인 (기본값 사용)');

        // ── STEP 3: 검색하기 버튼 클릭 ──
        console.log('[주문수집] Step3: 검색하기 클릭');
        await page.evaluate(() => {
            // 이지어드민 검색 함수 직접 호출 시도
            const w = window as unknown as Record<string, unknown>;
            if (typeof w['search_btn'] === 'function') {
                (w['search_btn'] as (n: number) => void)(1);
                return;
            }
            // 버튼 텍스트로 찾기
            const allElements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a');
            for (const el of Array.from(allElements)) {
                const text = ((el as HTMLInputElement).value || el.textContent || '').trim();
                if (text === '검색하기' || text === '검색') {
                    (el as HTMLElement).click();
                    return;
                }
            }
        });
        // 검색 결과 로딩 대기
        await new Promise(r => setTimeout(r, 5000));

        // ── STEP 4: 검색 결과 테이블 직접 파싱 ──
        // 다운로드관리자는 JS동적렌더링 문제로 사용 불가 → 화면 테이블을 직접 파싱
        console.log('[주문수집] Step4: 검색 결과 테이블 파싱');

        // 표시 수를 최대로 설정 (50개 → 500개)
        await page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            for (const sel of Array.from(selects)) {
                const opts = Array.from(sel.options).map(o => o.value);
                if (opts.includes('500')) {
                    sel.value = '500';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                } else if (opts.includes('200')) {
                    sel.value = '200';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                } else if (opts.includes('100')) {
                    sel.value = '100';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 500));

        // 다시 검색 (표시 수 변경 적용)
        await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            if (typeof w['search_btn'] === 'function') {
                (w['search_btn'] as (n: number) => void)(1);
                return;
            }
            const allElements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a');
            for (const el of Array.from(allElements)) {
                const text = ((el as HTMLInputElement).value || el.textContent || '').trim();
                if (text === '검색하기' || text === '검색') {
                    (el as HTMLElement).click();
                    return;
                }
            }
        });
        // 다시 검색 로딩 대기
        await new Promise(r => setTimeout(r, 5000));

        // 테이블 구조 확인
        const tableInfo = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            return {
                tableCount: tables.length,
                trCounts: Array.from(tables).map(t => t.querySelectorAll('tr').length),
                bodyText: (document.body.innerText || '').slice(0, 200),
            };
        });
        console.log('[주문수집] 테이블 구조:', JSON.stringify(tableInfo));

        // 주문 테이블 추출 (가장 행이 많은 테이블에서 헤더+데이터 추출)
        const allData: EzadminOrder[] = [];
        const firstPageData = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            let bestTable: HTMLTableElement | null = null;
            let maxRows = 0;

            // 헤더에 주문 관련 키워드가 있는 테이블 찾기
            for (const t of Array.from(tables)) {
                const ths = t.querySelectorAll('th');
                const headerTexts = Array.from(ths).map(th => (th.textContent || '').trim());
                if (headerTexts.some(h => h.includes('주문번호') || h.includes('주문일') || h.includes('판매건'))) {
                    bestTable = t as HTMLTableElement;
                    break;
                }
                // 행이 가장 많은 테이블 백업
                const rows = t.querySelectorAll('tr');
                if (rows.length > maxRows) {
                    maxRows = rows.length;
                    bestTable = t as HTMLTableElement;
                }
            }

            if (!bestTable) return { headers: [] as string[], items: [] as Record<string, string>[] };

            // 헤더 추출
            const headers: string[] = [];
            bestTable.querySelectorAll('th').forEach(th => {
                const text = (th.textContent || '').trim().replace(/\s+/g, ' ');
                if (text && text.length < 30) headers.push(text);
            });

            // 데이터 행 추출
            const items: Record<string, string>[] = [];
            const allRows = bestTable.querySelectorAll('tbody tr');
            const targetRows = allRows.length > 0 ? allRows : bestTable.querySelectorAll('tr');

            for (const row of Array.from(targetRows)) {
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) continue;

                const item: Record<string, string> = {};
                let cellIdx = 0;
                cells.forEach(cell => {
                    const key = headers[cellIdx] || `col${cellIdx}`;
                    item[key] = (cell.textContent || '').trim();
                    cellIdx++;
                });
                if (Object.keys(item).length > 0) items.push(item);
            }

            return { headers, items };
        });

        console.log(`[주문수집] 헤더: ${firstPageData.headers.join(', ')}`);
        console.log(`[주문수집] 첫 페이지: ${firstPageData.items.length}건`);

        // 문자열 → 숫자 변환
        for (const row of firstPageData.items) {
            const result: Record<string, string | number> = {};
            for (const [key, val] of Object.entries(row)) {
                const trimVal = String(val).trim();
                const num = Number(trimVal.replace(/,/g, ''));
                result[key] = !isNaN(num) && trimVal !== '' && trimVal.length < 12 ? num : trimVal;
            }
            allData.push(result);
        }

        // ── STEP 5: 페이지네이션 (2페이지 이상 있으면 계속) ──
        let pageNum = 2;
        while (pageNum <= 20) {
            const hasNext = await page.evaluate((pn: number) => {
                const links = document.querySelectorAll('a');
                for (const link of Array.from(links)) {
                    const onclick = link.getAttribute('onclick') || '';
                    const text = (link.textContent || '').trim();
                    if ((onclick.includes('search_btn') && onclick.includes(`(${pn})`)) ||
                        text === String(pn)) {
                        (link as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            }, pageNum);
            if (!hasNext) break;

            // 페이지 이동 대기
            await new Promise(r => setTimeout(r, 3000));

            const nextData = await page.evaluate((hdrs: string[]) => {
                const tables = document.querySelectorAll('table');
                let bestTable: HTMLTableElement | null = null;
                let maxRows = 0;
                for (const t of Array.from(tables)) {
                    const rows = t.querySelectorAll('tr');
                    if (rows.length > maxRows) { maxRows = rows.length; bestTable = t as HTMLTableElement; }
                }
                if (!bestTable) return [];
                const items: Record<string, string>[] = [];
                const allRows = bestTable.querySelectorAll('tbody tr');
                const targetRows = allRows.length > 0 ? allRows : bestTable.querySelectorAll('tr');
                for (const row of Array.from(targetRows)) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) continue;
                    const item: Record<string, string> = {};
                    let ci = 0;
                    cells.forEach(c => { item[hdrs[ci] || `col${ci}`] = (c.textContent || '').trim(); ci++; });
                    items.push(item);
                }
                return items;
            }, firstPageData.headers);

            if (nextData.length === 0) break;

            for (const row of nextData) {
                const result: Record<string, string | number> = {};
                for (const [key, val] of Object.entries(row)) {
                    const trimVal = String(val).trim();
                    const num = Number(trimVal.replace(/,/g, ''));
                    result[key] = !isNaN(num) && trimVal !== '' && trimVal.length < 12 ? num : trimVal;
                }
                allData.push(result);
            }
            console.log(`[주문수집] 페이지${pageNum}: +${nextData.length}건 (누적: ${allData.length}건)`);
            pageNum++;
        }

        console.log(`[주문수집] 완료: 총 ${allData.length}건 수집`);
        return { success: true, data: allData, currentUrl: page.url(), totalCount: allData.length };
    } catch (error) {
        console.error('[주문수집] 에러:', error);
        return { success: false, data: [], error: error instanceof Error ? error.message : '주문 스크래핑 실패' };
    } finally {
        await page.close();
    }
}

// ─── 유틸: 재고 전용 테이블 추출 (상품코드/가용재고 헤더 기반) ───
async function extractStockTable(page: Page): Promise<EzadminStockItem[]> {
    return page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        let stockTable: HTMLTableElement | null = null;

        // 헤더에 '상품코드'와 '가용재고'가 있는 테이블 찾기
        for (const t of Array.from(tables)) {
            const ths = t.querySelectorAll('th');
            const headerTexts = Array.from(ths).map(th => (th.textContent || '').trim());
            if (headerTexts.some(h => h.includes('상품코드')) && headerTexts.some(h => h.includes('가용재고'))) {
                stockTable = t as HTMLTableElement;
                break;
            }
        }

        if (!stockTable) return [];

        // 헤더 추출
        const headers: string[] = [];
        stockTable.querySelectorAll('th').forEach(th => {
            const text = (th.textContent || '').trim().replace(/\s+/g, ' ');
            if (text) headers.push(text);
        });

        // 데이터 행 추출 (tbody 내의 tr들)
        const items: Record<string, string | number>[] = [];
        const rows = stockTable.querySelectorAll('tbody tr');
        const targetRows = rows.length > 0 ? rows : stockTable.querySelectorAll('tr');

        for (const row of Array.from(targetRows)) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) continue; // 최소 3개 셀 필요

            const item: Record<string, string | number> = {};
            let cellIdx = 0;
            cells.forEach(cell => {
                const key = headers[cellIdx] || `col${cellIdx}`;
                const val = (cell.textContent || '').trim();
                // 숫자인 경우 number로 변환
                const num = Number(val.replace(/,/g, ''));
                item[key] = !isNaN(num) && val !== '' ? num : val;
                cellIdx++;
            });

            // 상품코드가 있는 행만 추가
            if (item['상품코드'] || item['col2']) {
                items.push(item);
            }
        }
        return items;
    });
}


// ─── 사이트 탐색 (디버깅/메뉴 구조 파악) ───
export async function exploreEzadmin(): Promise<{
    success: boolean; currentUrl: string; title: string;
    menuItems: Array<{ text: string; href: string }>; pageContent: string; error?: string;
}> {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        const loggedIn = await login(page);
        const currentUrl = page.url();
        const title = await page.title();
        // adminBase 변수는 여기서는 미사용

        // 좌측 메뉴 프레임 탐색 (이지어드민은 iframe/frame 구조일 수 있음)
        const frames = page.frames();
        let menuItems: Array<{ text: string; href: string }> = [];

        for (const frame of frames) {
            const links = await frame.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .map(a => ({ text: (a.textContent || '').trim(), href: a.href }))
                    .filter(m => m.text.length > 1 && m.text.length < 30 && m.href && !m.href.startsWith('javascript'));
            }).catch(() => []);
            menuItems = menuItems.concat(links);
        }

        // 중복 제거
        const seen = new Set<string>();
        menuItems = menuItems.filter(m => {
            const key = m.text + m.href;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 80);

        const pageContent = await page.evaluate(() => (document.body?.innerText || '').substring(0, 3000));
        return { success: loggedIn, currentUrl, title, menuItems, pageContent };
    } catch (error) {
        return {
            success: false, currentUrl: '', title: '', menuItems: [], pageContent: '',
            error: error instanceof Error ? error.message : '탐색 실패'
        };
    } finally {
        await page.close();
    }
}
