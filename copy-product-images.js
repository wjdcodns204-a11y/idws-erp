// 구글 드라이브의 제품컷 이미지를 ERP public 폴더에 복사하는 스크립트
const fs = require('fs');
const path = require('path');

const DRIVE_BASE = 'G:\\공유 드라이브\\IDWS\\상세페이지';
const ERP_PUBLIC = 'C:\\IDWS_ERP\\public\\products';
const SEASONS = ['23SS', '23FW', '24SS', '24FW', '25SS', '25FW', '26SS'];
const CATEGORIES = ['Top', 'Bottom', 'Outer', 'Acc'];
// 보정본 우선, 없으면 원본 사용
const IMAGE_FOLDERS = ['제품컷(보정)', '제품컷(원본)', '썸네일'];

let totalCopied = 0;
let totalSkipped = 0;
const results = [];

// public/products 폴더 생성
if (!fs.existsSync(ERP_PUBLIC)) fs.mkdirSync(ERP_PUBLIC, { recursive: true });

for (const season of SEASONS) {
    const seasonPath = path.join(DRIVE_BASE, season);
    if (!fs.existsSync(seasonPath)) continue;

    for (const cat of CATEGORIES) {
        const catPath = path.join(seasonPath, cat);
        if (!fs.existsSync(catPath)) continue;

        // 제품 폴더들
        let products;
        try { products = fs.readdirSync(catPath); } catch { continue; }

        for (const productDir of products) {
            const productPath = path.join(catPath, productDir);
            if (!fs.statSync(productPath).isDirectory()) continue;
            // 한글/특수폴더 스킵
            if (productDir.startsWith('(') || productDir.includes('셀렉') || productDir.includes('시딩')) continue;

            // 제품명으로 안전한 폴더명 생성 (공백 → 하이픈)
            const safeName = productDir.replace(/\s+/g, '-');
            const destDir = path.join(ERP_PUBLIC, safeName);

            // 이미지 폴더 우선순위대로 탐색
            let found = false;
            for (const imgFolder of IMAGE_FOLDERS) {
                const imgPath = path.join(productPath, imgFolder);
                if (!fs.existsSync(imgPath)) continue;

                let files;
                try { files = fs.readdirSync(imgPath); } catch { continue; }
                const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
                if (images.length === 0) continue;

                // 대상 폴더 생성
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                // 첫 번째 이미지를 대표 이미지(thumbnail.jpg)로 복사
                const thumbSrc = path.join(imgPath, images[0]);
                const thumbDest = path.join(destDir, 'thumbnail' + path.extname(images[0]));
                if (!fs.existsSync(thumbDest)) {
                    fs.copyFileSync(thumbSrc, thumbDest);
                    totalCopied++;
                }

                // 나머지 이미지도 복사
                for (let i = 0; i < images.length; i++) {
                    const src = path.join(imgPath, images[i]);
                    const dest = path.join(destDir, images[i]);
                    if (!fs.existsSync(dest)) {
                        fs.copyFileSync(src, dest);
                        totalCopied++;
                    } else {
                        totalSkipped++;
                    }
                }

                results.push({ product: productDir, season, category: cat, source: imgFolder, imageCount: images.length });
                found = true;
                break; // 첫 번째 찾은 폴더 사용
            }

            if (!found) {
                // 썸네일 하위 폴더 (무신사, 29CM 등) 탐색
                const thumbPath = path.join(productPath, '썸네일');
                if (fs.existsSync(thumbPath)) {
                    try {
                        const subDirs = fs.readdirSync(thumbPath);
                        for (const sub of subDirs) {
                            const subPath = path.join(thumbPath, sub);
                            if (!fs.statSync(subPath).isDirectory()) continue;
                            let files;
                            try { files = fs.readdirSync(subPath); } catch { continue; }
                            const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
                            if (images.length === 0) continue;

                            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                            const thumbSrc = path.join(subPath, images[0]);
                            const thumbDest = path.join(destDir, 'thumbnail' + path.extname(images[0]));
                            if (!fs.existsSync(thumbDest)) {
                                fs.copyFileSync(thumbSrc, thumbDest);
                                totalCopied++;
                            }
                            results.push({ product: productDir, season, category: cat, source: '썸네일/' + sub, imageCount: images.length });
                            found = true;
                            break;
                        }
                    } catch { }
                }
            }
        }
    }
}

console.log(`\n=== 제품 이미지 복사 완료 ===`);
console.log(`복사: ${totalCopied}개, 스킵(이미 존재): ${totalSkipped}개`);
console.log(`제품 수: ${results.length}개`);
console.log(`\n제품 목록:`);
results.forEach(r => console.log(`  ${r.season} | ${r.category} | ${r.product} (${r.source}: ${r.imageCount}장)`));

// 결과 JSON 저장
fs.writeFileSync('C:/IDWS_ERP/product-images-result.json', JSON.stringify(results, null, 2));
console.log('\n결과 저장: product-images-result.json');
