# Google Search Console 設定指南

本指南將協助你將 WANT CAR 網站提交到 Google Search Console，以優化搜尋引擎索引和監控 SEO 表現。

## 📋 前置作業

### 1. 驗證 SEO 設定

執行 SEO 健康檢查腳本：

```bash
npx tsx scripts/seo-health-check.ts
```

**應確保所有檢查項目通過**：
- ✅ Sitemap.xml 可訪問且格式正確
- ✅ Robots.txt 可訪問且包含 sitemap 引用
- ✅ 文章包含 JSON-LD 結構化資料
- ✅ Meta tags 完整（title, description, og:*, twitter:*）

### 2. 確認網址

- **生產環境**: https://wantcar.autos
- **Sitemap URL**: https://wantcar.autos/sitemap.xml
- **Robots.txt**: https://wantcar.autos/robots.txt

---

## 🚀 Google Search Console 設定步驟

### Step 1: 訪問 Google Search Console

1. 訪問：https://search.google.com/search-console
2. 使用 Google 帳號登入（建議使用公司/專案帳號）

### Step 2: 新增資源

1. 點擊左上角「新增資源」
2. 選擇「網域」或「網址前置字串」
   - **建議使用「網域」**: 輸入 `wantcar.autos`（涵蓋所有子網域和 http/https）
   - 或使用「網址前置字串」: 輸入 `https://wantcar.autos`

### Step 3: 驗證網站擁有權

有多種驗證方式，以下為最常用的：

#### 方法 1: HTML 檔案上傳（推薦）

1. Google 會提供一個驗證檔案（如 `google1234567890abcdef.html`）
2. 下載檔案
3. 將檔案放置到網站根目錄：
   ```bash
   # 將檔案放到 public 資料夾
   cp google1234567890abcdef.html /path/to/car-news-ai/public/

   # 部署到生產環境
   git add public/google1234567890abcdef.html
   git commit -m "Add Google Search Console verification file"
   git push
   ```
4. 確認可訪問：`https://wantcar.autos/google1234567890abcdef.html`
5. 在 Google Search Console 點擊「驗證」

#### 方法 2: HTML 標籤

1. Google 會提供一個 meta 標籤
2. 將標籤加入 `src/app/layout.tsx` 的 `<head>` 中：
   ```tsx
   export const metadata: Metadata = {
     verification: {
       google: 'your-verification-code-here'
     },
     // ... other metadata
   }
   ```
3. 部署後點擊「驗證」

#### 方法 3: DNS 記錄（適用於「網域」驗證）

1. Google 會提供一個 TXT 記錄
2. 登入域名註冊商（如 Cloudflare, GoDaddy）
3. 新增 DNS TXT 記錄：
   ```
   Name: @
   Type: TXT
   Value: google-site-verification=xxxxxxxxxxxx
   ```
4. 等待 DNS 傳播（可能需 5-30 分鐘）
5. 在 Google Search Console 點擊「驗證」

---

## 📊 提交 Sitemap

驗證完成後，立即提交 sitemap：

### Step 1: 進入 Sitemaps 頁面

1. 在左側選單點擊「Sitemaps」
2. 在「新增 Sitemap」欄位輸入：`sitemap.xml`
3. 點擊「提交」

### Step 2: 驗證提交成功

- 狀態應顯示「成功」（Success）
- 可能需要幾小時到幾天才會開始索引
- 初次索引後，系統會顯示：
  - 已發現的網址數量
  - 已索引的網址數量
  - 錯誤和警告（如果有）

---

## 🔍 監控和優化

### 1. 檢查索引涵蓋範圍

**路徑**: `索引 > 網頁`

**應檢查項目**:
- ✅ 所有已發布文章都被索引
- ⚠️ 排除的頁面是否正確（如 `/api/`, `/admin/`）
- ❌ 任何錯誤（404, 5xx, redirect 錯誤）

### 2. 監控搜尋效能

**路徑**: `效能`

**關鍵指標**:
- **點擊次數**: 用戶實際點擊次數
- **曝光次數**: 在搜尋結果中顯示次數
- **平均點閱率 (CTR)**: 點擊次數 / 曝光次數
- **平均排名**: 搜尋結果中的平均位置

**目標**:
- CTR > 2% (初期)，目標 5-10%
- 平均排名 < 20（首兩頁）

### 3. 檢查核心網頁指標 (Core Web Vitals)

**路徑**: `體驗 > 核心網頁指標`

**應監控**:
- **LCP (Largest Contentful Paint)**: < 2.5s (良好)
- **FID (First Input Delay)**: < 100ms (良好)
- **CLS (Cumulative Layout Shift)**: < 0.1 (良好)

### 4. 檢查行動裝置可用性

**路徑**: `體驗 > 行動裝置可用性`

**確保**:
- 無行動裝置錯誤
- 文字大小適當
- 可點擊元素間距足夠
- 內容寬度適合螢幕

### 5. 檢查結構化資料

**路徑**: `體驗 > 結構化資料`

**應確認**:
- NewsArticle schema 正確顯示
- 無錯誤或警告
- Rich Results 類型：文章、新聞

---

## 📈 進階優化建議

### 1. 設定 Email 通知

**路徑**: `設定 > 使用者和權限`

- 新增團隊成員的 Email
- 啟用重要通知（索引錯誤、安全性問題、手動處置措施）

### 2. 查看搜尋查詢

**路徑**: `效能 > 搜尋結果`

**分析**:
- 哪些關鍵字帶來流量？
- 哪些頁面表現最好？
- 哪些查詢的 CTR 低？（可優化標題/描述）

### 3. 內部連結優化

**路徑**: `連結 > 內部連結`

**檢查**:
- 重要頁面的內部連結數量
- 孤立頁面（無內部連結）

### 4. 手動要求索引

對於重要的新文章：

1. 前往「網址審查」工具
2. 輸入文章 URL
3. 如果未索引，點擊「要求建立索引」
4. Google 會優先處理該 URL

---

## 🛠️ 常見問題排解

### Q1: Sitemap 提交後顯示「無法讀取」

**解決方法**:
```bash
# 1. 檢查 sitemap 是否可訪問
curl -I https://wantcar.autos/sitemap.xml

# 2. 驗證 XML 格式
curl https://wantcar.autos/sitemap.xml | head -50

# 3. 確認 Content-Type
# 應為: Content-Type: application/xml
```

### Q2: 大部分頁面顯示「已排除」

**可能原因**:
- Robots.txt 阻擋
- Meta robots noindex
- Canonical 指向其他 URL
- 重複內容

**檢查**:
```bash
# 檢查 robots.txt
curl https://wantcar.autos/robots.txt

# 檢查特定頁面
curl -I https://wantcar.autos/2025/11/xxxxx
```

### Q3: 索引速度慢

**正常情況**:
- 新網站：可能需要 1-4 週
- 新頁面：通常 1-7 天

**加速方法**:
1. 手動要求索引（每天限額：約 10 個 URL）
2. 提高網站權重（外部連結、社群分享）
3. 保持內容更新頻率

### Q4: Core Web Vitals 不佳

**優化建議**:
1. **LCP 優化**:
   - 使用 Next.js Image 優化
   - 啟用 CDN
   - 減少首屏載入資源

2. **FID 優化**:
   - 減少 JavaScript bundle size
   - 延遲載入非關鍵腳本

3. **CLS 優化**:
   - 為圖片設定明確的寬高
   - 避免動態注入內容
   - 預留廣告空間

---

## 📅 定期維護檢查清單

### 每週檢查
- [ ] 索引涵蓋範圍有無新錯誤
- [ ] 搜尋效能趨勢（點擊、曝光、CTR）
- [ ] 新文章是否被索引

### 每月檢查
- [ ] Core Web Vitals 表現
- [ ] 熱門搜尋查詢分析
- [ ] 內部/外部連結狀況
- [ ] 行動裝置可用性

### 每季檢查
- [ ] 競爭對手分析
- [ ] SEO 策略調整
- [ ] 內容更新計畫
- [ ] 結構化資料優化

---

## 🔗 相關資源

- **Google Search Console**: https://search.google.com/search-console
- **Rich Results Test**: https://search.google.com/test/rich-results
- **PageSpeed Insights**: https://pagespeed.web.dev/
- **Google Search Central**: https://developers.google.com/search

---

## 📞 需要協助？

如果遇到問題：
1. 查看 Google Search Console 的「說明」區域
2. 閱讀 [Google 搜尋中心文件](https://developers.google.com/search/docs)
3. 執行 `npx tsx scripts/seo-health-check.ts` 診斷本地問題
4. 檢查 Admin Dashboard 的 Duplicate Monitor

---

**最後更新**: 2025-11-25
**維護者**: WANT CAR 技術團隊
