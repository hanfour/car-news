# 🚗 Car News AI

AI驅動的汽車新聞聚合平台，自動抓取、分析、重寫並發布繁體中文汽車資訊。

## 📋 專案概述

本專案使用AI（Claude + OpenAI）自動化以下流程：

1. **爬取**：從多個國外汽車網站抓取新聞
2. **聚類**：使用語義向量找出相似主題的文章
3. **生成**：Claude分析多個來源，生成客觀的繁體中文綜合報導
4. **審核**：AI自動檢查內容質量和評論合規性
5. **發布**：自動發布高質量文章到網站

## 🛠 技術棧

- **前端**: Next.js 15 + TypeScript + Tailwind CSS
- **後端**: Next.js API Routes + Vercel Cron
- **數據庫**: Supabase (PostgreSQL + pgvector)
- **AI**: Claude 3.5 Sonnet (生成) + Haiku (審核) + OpenAI Embeddings
- **部署**: Vercel Pro

## 💰 成本預估

- Vercel Pro: $20/月（已有）
- Supabase: $0（免費層）
- AI API: ~$7/月（每天生成10篇文章）
- **總計**: ~$27/月

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 配置環境變量

```bash
cp .env.local.example .env.local
```

編輯 `.env.local` 填入：
- Supabase credentials
- Anthropic API key
- OpenAI API key
- 隨機生成的CRON_SECRET

### 3. 設置Supabase

1. 前往 [Supabase](https://supabase.com) 創建新專案
2. 在SQL Editor執行 `supabase/migrations/001_initial_schema.sql`
3. 複製項目URL和keys到 `.env.local`

### 4. 本地開發

```bash
npm run dev
```

訪問 `http://localhost:3000`

### 5. 部署到Vercel

```bash
# 連接Vercel（如果還沒有）
vercel link

# 設置環境變量
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
vercel env add CRON_SECRET

# 部署
vercel --prod
```

## 📁 專案結構

```
car-news-ai/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   ├── cron/          # Cron job endpoints
│   │   │   ├── comments/      # 評論API
│   │   │   └── share/         # 分享API
│   │   ├── [year]/[month]/[id]-[slug]/  # 文章頁
│   │   └── page.tsx           # 首頁
│   ├── lib/
│   │   ├── ai/                # AI模組
│   │   ├── scraper/           # 爬蟲模組
│   │   ├── generator/         # 文章生成器
│   │   └── utils/             # 工具函數
│   ├── config/
│   │   └── prompts/           # AI Prompt配置
│   └── types/                 # TypeScript類型
├── supabase/
│   └── migrations/            # 數據庫schema
└── vercel.json                # Vercel Cron配置
```

## ⏱ Cron任務

- **Scraper** (`/api/cron/scraper`): 每2小時抓取新文章
- **Generator** (`/api/cron/generator`): 每6小時生成文章
- **Cleanup** (`/api/cron/cleanup`): 每天清理過期數據

## 🔒 安全性

- Cron endpoints使用 `CRON_SECRET` 驗證
- Supabase使用Row Level Security (RLS)
- 評論AI審核（置信度>95%才拒絕）
- 每日主題鎖防止重複生成

## 📊 下一步開發

目前創建的是核心基礎架構。還需要實現：

1. **爬蟲系統** (`src/lib/scraper/`)
2. **Cron API Routes** (`src/app/api/cron/`)
3. **前端頁面**（首頁、文章詳情頁）
4. **評論系統**
5. **廣告整合**（Google AdSense）

## 📝 授權

MIT
