---
description: 구글 드라이브의 제품 사진을 ERP에 업로드하는 방법
---

# 구글 드라이브 제품 사진 → ERP 업로드

## 폴더 구조

구글 드라이브의 제품 사진은 다음 경로에 있습니다:

```
G:\공유 드라이브\IDWS\상세페이지\{시즌}\{카테고리}\{제품명 색상}\{이미지폴더}\
```

### 시즌 폴더

23SS, 23FW, 24SS, 24FW, 25SS, 25FW, 26SS

### 카테고리

- **Top** — 상의 (티셔츠, 니트, 셔츠 등)
- **Bottom** — 하의 (데님, 트라우저 등)
- **Outer** — 아우터 (자켓, 블루종 등)
- **Acc** — 악세서리 (모자, 가방, 반지 등)

### 이미지 폴더 (제품 폴더 내부)

- `제품컷(보정)` ← **최우선 사용** (전문 보정 완료 이미지)
- `제품컷(원본)` ← 보정 없으면 원본 사용
- `썸네일/무신사(자사몰)` ← 썸네일 이미지
- `피팅컷(보정)` / `피팅컷(원본)` — 모델 착용 사진
- `컨텐츠컷` — SNS용 컨텐츠 이미지
- `상세페이지` — 상세페이지용 이미지

## 자동 복사 스크립트

// turbo

```powershell
cd C:\IDWS_ERP
node copy-product-images.js
```

스크립트 위치: `C:\IDWS_ERP\copy-product-images.js`

### 스크립트 동작 방식

1. `23SS` ~ `26SS` 모든 시즌 폴더 순회
2. `Top/Bottom/Outer/Acc` 카테고리 순회
3. 각 제품 폴더 내 `제품컷(보정)` > `제품컷(원본)` > `썸네일` 우선순위로 이미지 탐색
4. `public/products/{제품명-색상}/thumbnail.jpg` + 개별 이미지로 복사
5. 결과를 `product-images-result.json`에 저장

### ERP에서의 이미지 접근 경로

```
http://localhost:3000/products/{제품명-색상}/thumbnail.jpg
```

예시: `http://localhost:3000/products/Novichi-Knit-Black/thumbnail.jpg`

## 새 시즌 제품 추가 시

1. 구글 드라이브에 `상세페이지/{시즌}/{카테고리}/{제품명 색상}/제품컷(보정)/` 폴더 구조 생성
2. 보정된 제품 사진 업로드
3. `node copy-product-images.js` 재실행
