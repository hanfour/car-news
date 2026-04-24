# 📊 Car News AI - 項目現狀

## ✅ 已完成（第一階段：核心基礎）

### 1. 專案結構
- ✅ Next.js 15 + TypeScript 專案初始化
- ✅ 目錄結構完整創建
- ✅ 依賴安裝完成

### 2. 數據庫設計
- ✅ 完整的PostgreSQL schema (`supabase/migrations/001_initial_schema.sql`)
- ✅ 包含9張表：
  - `raw_articles` - 來源文章（含embedding）
  - `article_clusters` - 聚類結果
  - `generated_articles` - AI生成文章
  - `daily_topic_locks` - 防重複機制
  - `comments` - 評論系統
  - `share_events` - 分享統計
  - `style_configs` - 風格版本管理
  - `cron_logs` - Cron監控
- ✅ 觸發器和視圖
- ✅ pgvector擴展支持

### 3. AI核心模組
- ✅ Claude API集成 (`src/lib/ai/claude.ts`)
  - 文章生成函數
  - 評論審核函數
- ✅ OpenAI Embeddings (`src/lib/ai/embeddings.ts`)
  - Embedding生成
  - 余弦相似度計算
- ✅ 聚類算法 (`src/lib/ai/clustering.ts`)
  - 貪心聚類實現
  - 聚類中心計算

### 4. 工具函數
- ✅ Supabase客戶端 (`src/lib/supabase.ts`)
- ✅ 短ID生成器 (`src/lib/utils/short-id.ts`)
- ✅ Slug處理 (`src/lib/utils/slug.ts`)
- ✅ 主題Hash (`src/lib/utils/topic-hash.ts`)

### 5. Prompt配置
- ✅ System Prompt (`src/config/prompts/system.txt`)
- ✅ Style Guide (`src/config/prompts/style-guide.txt`)
- ✅ Prompt加載器 (`src/config/prompts/index.ts`)

### 6. 類型定義
- ✅ 完整的TypeScript types (`src/types/database.ts`)

### 7. 配置文件
- ✅ Vercel Cron配置 (`vercel.json`)
- ✅ 環境變量模板 (`.env.local.example`)
- ✅ README文檔
- ✅ 部署清單 (`DEPLOYMENT.md`)

---

## ⏳ 待實現（第二階段：功能開發）

### 1. 爬蟲系統 🔴 HIGH PRIORITY
**位置**: `src/lib/scraper/`

需要創建：
```
src/lib/scraper/
├── sources.json          # 新聞源配置
├── fetcher.ts           # HTTP請求
├── rss-parser.ts        # RSS解析
├── html-parser.ts       # 網頁內容提取
└── index.ts             # 統一接口
```

**關鍵功能**：
- RSS feed解析
- 網頁內容抓取（使用cheerio或puppeteer）
- URL去重
- 錯誤處理和重試

---

### 2. Cron API Routes 🔴 HIGH PRIORITY
**位置**: `src/app/api/cron/`

需要創建：
```
src/app/api/cron/
├── scraper/route.ts      # 爬蟲任務
├── generator/route.ts    # 生成任務
└── cleanup/route.ts      # 清理任務
```

**scraper/route.ts 邏輯**：
1. 驗證CRON_SECRET
2. 調用scraper抓取新文章
3. 生成embedding
4. 保存到raw_articles
5. 清理過期文章
6. 記錄日誌

**generator/route.ts 邏輯**：
1. 驗證CRON_SECRET
2. 獲取未過期文章
3. 聚類分析
4. 檢查daily_topic_locks
5. AI生成文章
6. 質量檢查
7. 自動發布（confidence>80）
8. 記錄日誌

**cleanup/route.ts 邏輯**：
1. 驗證CRON_SECRET
2. 清理過期raw_articles
3. 清理舊的daily_topic_locks
4. 記錄日誌

---

### 3. 文章生成器封裝 🟡 MEDIUM PRIORITY
**位置**: `src/lib/generator/`

需要創建：
```
src/lib/generator/
├── article-generator.ts  # 調用Claude生成
├── quality-check.ts      # 質量檢查邏輯
└── index.ts             # 統一接口
```

---

### 4. 前端頁面 🟡 MEDIUM PRIORITY
**位置**: `src/app/`

需要創建：
```
src/app/
├── page.tsx                           # 首頁（已存在，需修改）
├── [year]/[month]/[id]-[slug]/
│   └── page.tsx                      # 文章詳情頁
└── components/
    ├── ArticleList.tsx               # 文章卡片列表
    ├── ArticleCard.tsx               # 單個文章卡片
    ├── ArticleContent.tsx            # 文章內容渲染（Markdown）
    ├── SourceLinks.tsx               # 來源鏈接展示
    ├── ShareButtons.tsx              # 分享按鈕
    ├── CommentSection.tsx            # 評論區
    ├── CommentForm.tsx               # 評論表單
    └── AdBanner.tsx                  # 廣告組件
```

**首頁需求**：
- 顯示最新20篇文章
- 分頁功能
- 響應式設計
- Loading狀態

**文章詳情頁需求**：
- 從URL提取短ID
- 顯示文章內容（Markdown渲染）
- 顯示來源鏈接
- 分享按鈕
- 評論區
- 廣告位
- 增加view_count

---

### 5. 評論API 🟡 MEDIUM PRIORITY
**位置**: `src/app/api/comments/`

需要創建：
```
src/app/api/comments/
└── route.ts
    ├── GET  - 獲取文章評論列表
    └── POST - 提交新評論（含AI審核）
```

**POST邏輯**：
1. 驗證輸入（author_name, content, article_id）
2. 調用Claude Haiku審核
3. 如果confidence>95且有flags → 拒絕
4. 否則保存並顯示
5. 返回結果

---

### 6. 分享API 🟢 LOW PRIORITY
**位置**: `src/app/api/share/`

需要創建：
```
src/app/api/share/
└── route.ts
    └── POST - 記錄分享事件
```

簡單實現：
1. 驗證輸入（article_id, platform）
2. 插入share_events表
3. 觸發器自動增加share_count

---

### 7. 廣告整合 🟢 LOW PRIORITY

**Google AdSense設置**：
1. 申請AdSense（需要有內容和流量）
2. 添加 `public/ads.txt`
3. 創建AdBanner組件
4. 在首頁和文章頁插入廣告位

---

## 🎯 開發優先級建議

### Phase 1: 核心功能（1-2週）
1. ✅ ~~基礎架構~~ (已完成)
2. 🔴 爬蟲系統
3. 🔴 Cron API Routes
4. 🔴 簡單的首頁和文章頁

**目標**: 系統能自動抓取、生成、發布文章

### Phase 2: 用戶互動（1週）
5. 🟡 評論系統
6. 🟡 分享功能
7. 🟡 前端UI優化

**目標**: 用戶能瀏覽、評論、分享文章

### Phase 3: 變現準備（1週）
8. 🟢 申請Google AdSense
9. 🟢 廣告位整合
10. 🟢 SEO優化（sitemap, meta tags）

**目標**: 開始產生廣告收入

---

## 📝 下一步行動

### 立即行動（如果你要繼續開發）：

1. **設置Supabase**
   ```bash
   # 前往 https://supabase.com 創建專案
   # 執行 supabase/migrations/001_initial_schema.sql
   # 獲取credentials
   ```

2. **配置環境變量**
   ```bash
   cp .env.local.example .env.local
   # 編輯 .env.local 填入所有keys
   ```

3. **實現爬蟲**（如果你想讓我繼續幫你）
   - 選擇3-5個汽車新聞源（RSS或網站）
   - 我會幫你實現scraper

4. **或直接測試核心功能**
   ```bash
   npm run dev
   # 手動測試AI模組是否工作
   ```

---

## 💡 重要提醒

### 成本控制
- 前期測試時，建議手動觸發Cron（不要等自動執行）
- 監控AI API使用量
- Supabase免費層500MB夠用很久

### 數據源選擇
建議從這些開始：
- **RSS源**（最簡單）:
  - Motor Trend RSS
  - Car and Driver RSS
  - Autoblog RSS

- **網頁抓取**（需要更多處理）:
  - BBC Autos
  - The Verge Cars
  - Jalopnik

### 測試策略
1. 先用1-2個RSS源測試完整流程
2. 確認AI生成質量
3. 再擴展到更多來源

---

## 📞 如果需要幫助

如果你想讓我繼續實現剩餘功能，告訴我：

1. **"實現爬蟲系統"** - 我會創建完整的scraper
2. **"實現Cron routes"** - 我會創建所有API endpoints
3. **"實現前端"** - 我會創建首頁和文章頁
4. **"全部實現"** - 我會完成所有剩餘功能

或者你可以按照這個文檔自己實現。架構已經100%完成，剩下的是"填空"。
