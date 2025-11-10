# 🚀 部署清單

## 前置準備

### 1. 註冊必要服務

- [ ] Supabase 帳號
- [ ] Anthropic API key
- [ ] OpenAI API key
- [ ] Vercel Pro 帳號（已有✓）

---

## 步驟1：設置Supabase

### 1.1 創建專案

1. 前往 https://supabase.com
2. 點擊 "New Project"
3. 填寫專案名稱：`car-news-ai`
4. 選擇區域：建議選擇離台灣最近的（Singapore或Tokyo）
5. 設置強密碼並保存

### 1.2 執行數據庫遷移

1. 進入專案 Dashboard
2. 點擊左側 "SQL Editor"
3. 點擊 "New query"
4. 複製 `supabase/migrations/001_initial_schema.sql` 的完整內容
5. 貼上並執行（點擊"Run"）
6. 確認無錯誤

### 1.3 獲取Credentials

1. 點擊左側 "Project Settings" → "API"
2. 複製以下內容：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbG...`
   - **service_role key**: `eyJhbG...` (點擊"Reveal"顯示)

---

## 步驟2：獲取AI API Keys

### 2.1 Anthropic API Key

1. 前往 https://console.anthropic.com
2. 點擊 "Get API Keys"
3. 點擊 "Create Key"
4. 命名為 "car-news-ai"
5. 複製key（格式：`sk-ant-api03-xxx`）

### 2.2 OpenAI API Key

1. 前往 https://platform.openai.com/api-keys
2. 點擊 "Create new secret key"
3. 命名為 "car-news-ai-embeddings"
4. 複製key（格式：`sk-xxx`）

---

## 步驟3：配置本地環境

### 3.1 創建環境變量文件

```bash
cd /Users/hanfourhuang/Projects/car-news-ai
cp .env.local.example .env.local
```

### 3.2 填入環境變量

編輯 `.env.local`：

```bash
# Supabase（從步驟1.3獲取）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# AI APIs（從步驟2獲取）
ANTHROPIC_API_KEY=sk-ant-api03-xxx
OPENAI_API_KEY=sk-xxx

# Cron Security（生成隨機字符串）
CRON_SECRET=$(openssl rand -base64 32)
```

### 3.3 測試本地運行

```bash
npm run dev
```

訪問 http://localhost:3000 確認無錯誤

---

## 步驟4：部署到Vercel

### 4.1 推送代碼到GitHub

```bash
# 如果還沒初始化git
git init
git add .
git commit -m "Initial commit: Car News AI"

# 創建GitHub repo並推送
# （在GitHub創建新repo: car-news-ai）
git remote add origin https://github.com/你的用戶名/car-news-ai.git
git branch -M main
git push -u origin main
```

### 4.2 連接Vercel

**方式A：通過Dashboard**
1. 前往 https://vercel.com
2. 點擊 "Add New..." → "Project"
3. 選擇剛才的GitHub repo
4. 點擊 "Import"

**方式B：通過CLI**
```bash
vercel link
```

### 4.3 配置環境變量

**方式A：通過Dashboard**
1. 在Vercel專案頁面，點擊 "Settings"
2. 點擊左側 "Environment Variables"
3. 依次添加以下變量（Value從 `.env.local` 複製）：

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxx.supabase.co | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJhbG... | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJhbG... | Production |
| `ANTHROPIC_API_KEY` | sk-ant-... | Production |
| `OPENAI_API_KEY` | sk-... | Production |
| `CRON_SECRET` | 隨機字符串 | Production |

**方式B：通過CLI**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add OPENAI_API_KEY production
vercel env add CRON_SECRET production
```

### 4.4 部署

```bash
vercel --prod
```

等待部署完成（約2-3分鐘）

---

## 步驟5：驗證部署

### 5.1 檢查網站

訪問Vercel提供的URL（如 `https://car-news-ai.vercel.app`）

應該看到：
- [ ] 首頁正常加載
- [ ] 無console錯誤

### 5.2 檢查Cron任務

1. 在Vercel Dashboard → "Cron Jobs"
2. 應該看到3個任務：
   - [ ] `/api/cron/scraper` - 每2小時
   - [ ] `/api/cron/generator` - 每6小時
   - [ ] `/api/cron/cleanup` - 每天

### 5.3 手動觸發測試（可選）

```bash
# 測試scraper（需要替換你的域名和CRON_SECRET）
curl -X GET https://your-domain.vercel.app/api/cron/scraper \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 步驟6：監控和維護

### 6.1 設置監控

**Vercel Logs**
- Dashboard → "Logs" 查看實時日誌
- 檢查Cron任務執行情況

**Supabase Dashboard**
- 查看 `cron_logs` 表
- 查看 `generated_articles` 表確認文章生成

### 6.2 成本監控

**AI API使用**
- Anthropic Console: https://console.anthropic.com/settings/usage
- OpenAI Dashboard: https://platform.openai.com/usage

**Supabase使用**
- Dashboard → "Settings" → "Usage"
- 監控數據庫大小（免費層500MB）

---

## 常見問題

### Q: Cron任務沒有執行？
A: 檢查：
1. Vercel Pro訂閱是否有效
2. `vercel.json` 配置是否正確
3. 環境變量 `CRON_SECRET` 是否設置

### Q: AI API報錯？
A: 檢查：
1. API keys是否正確
2. 是否有足夠餘額
3. 查看Vercel Logs具體錯誤信息

### Q: 數據庫連接失敗？
A: 檢查：
1. Supabase URL和keys是否正確
2. Supabase專案是否暫停（免費層閒置7天會暫停）

---

## 下一步

部署完成後，你需要：

1. **實現爬蟲源** - 添加真實的新聞網站URL到 `src/config/sources.json`
2. **測試完整流程** - 等待第一次Cron執行（最多6小時）
3. **申請Google AdSense** - 在有內容後申請廣告
4. **設置域名**（可選）- 在Vercel綁定自定義域名

---

## 緊急回滾

如果部署出現嚴重問題：

```bash
# 回滾到上一個版本
vercel rollback
```

或在Vercel Dashboard → "Deployments" 點擊之前的部署 → "Promote to Production"
