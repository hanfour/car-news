# Admin API 快速開始指南

✅ **API 已確認正常運作**
✅ **Migration 已完成**
✅ **目前有 62 篇已發布文章**

---

## 🚀 方法 1: 使用 Postman（推薦）

### 步驟 1: 準備 Collection

1. 複製範本：`cp Admin_API.postman_collection.json.example Admin_API.postman_collection.json`
2. 編輯複製出的檔案，把 `{{ADMIN_API_KEY}}` 變數的 value 改為你的真實 admin key（從 `.env.local` 取得）

> 範本檔 `.example` 才是隨 repo 提供的版本；複製出來的本地檔已被 `.gitignore` 排除（`*.postman_collection.json`），不會誤 commit 含密鑰版本。

### 步驟 2: 匯入 Postman

1. 打開 Postman
2. 點擊 **Import** 按鈕
3. 選擇你剛剛複製出來的 `Admin_API.postman_collection.json`
4. 點擊 **Import**

**常用操作流程：**

1. **查看文章列表**
   → 展開 `📋 文章列表`
   → 點選 `列出所有已發布文章`
   → 按 **Send**

2. **給文章評分**
   → 從列表中複製文章 `id`（例如：`xjBZdZD`）
   → 展開 `⭐ 文章評分`
   → 選擇評分等級（1-5 分）
   → 點擊 URL 中的 `:articleId`，貼上文章 ID
   → 按 **Send**

3. **下架低品質文章**
   → 展開 `📝 文章管理`
   → 選擇 `下架 + 評差 (2分)`
   → 替換 `:articleId`
   → 按 **Send**

---

## 💻 方法 2: 使用 curl（命令列）

### 基本指令範例

**1. 查看所有已發布文章（前 10 篇）**

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=10"
```

**2. 給文章評 5 分（優秀）**

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

**3. 下架文章**

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": false}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

**4. 下架 + 評差 (2分)**

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": false, "human_rating": 2}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

**5. 篩選特定品牌（Tesla）**

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&brand=Tesla&limit=20"
```

**6. 刪除文章（不可復原）**

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

**7. 查看統計資訊**

```bash
# 總文章數
curl -s -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?limit=1" | python3 -m json.tool | grep total

# 已發布數
curl -s -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=1" | python3 -m json.tool | grep total
```

---

## 📊 評分標準建議

- **5 分（優秀）**：內容準確、結構完整、值得作為 AI 訓練範例
- **4 分（良好）**：品質不錯，但有小瑕疵
- **3 分（普通）**：可接受，但有改進空間
- **2 分（差）**：品質不佳，建議下架
- **1 分（極差）**：嚴重問題，應立即刪除

---

## 🔍 常見工作流程

### 每週品質審查

```bash
# 步驟 1: 找出低品質文章（confidence < 70）
curl -s -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=100" \
  | python3 -c "import sys,json; [print(f\"ID: {a['id']:10} | Conf: {a['confidence']:2} | {a['title_zh'][:50]}\") for a in json.load(sys.stdin)['articles'] if a['confidence'] < 70]"

# 步驟 2: 人工審查並評分
# 使用 Postman 或 curl 給每篇文章評分

# 步驟 3: 下架差文章
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": false, "human_rating": 2}' \
  "http://localhost:3000/api/admin/articles/BAD_ARTICLE_ID"
```

### 標記優質文章（用於未來 AI 訓練）

```bash
# 步驟 1: 找出高 confidence 文章
curl -s -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=50" \
  | python3 -c "import sys,json; [print(f\"ID: {a['id']:10} | Conf: {a['confidence']:2} | {a['title_zh'][:50]}\") for a in json.load(sys.stdin)['articles'] if a['confidence'] >= 85]"

# 步驟 2: 人工確認後評 5 分
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/GOOD_ARTICLE_ID"
```

---

## 📖 API 端點總覽

| 方法   | 路徑                      | 功能                             |
| ------ | ------------------------- | -------------------------------- |
| GET    | `/api/admin/articles`     | 列出文章（支援篩選、分頁）       |
| PATCH  | `/api/admin/articles/:id` | 更新文章（評分、下架、修改內容） |
| DELETE | `/api/admin/articles/:id` | 刪除文章（不可復原）             |

### Query Parameters (GET)

- `published` - `true` / `false` / 留空（全部）
- `brand` - 品牌英文名稱（例如：`Tesla`）
- `limit` - 每頁數量（預設 50）
- `offset` - 跳過前 N 筆（用於分頁）

### Body Parameters (PATCH)

可更新的欄位：

- `human_rating` - 評分 1-5
- `published` - `true` / `false`
- `title_zh` - 標題
- `content_zh` - 內容
- `categories` - 分類陣列
- `tags` - 標籤陣列
- `brands` - 品牌陣列
- `car_models` - 車型陣列
- `cover_image` - 封面圖

---

## 🎯 建議目標

**短期（本週）：**

- 審查所有 `confidence < 70` 的文章
- 下架品質不佳的文章
- 給 10-20 篇優秀文章評 5 分

**中期（本月）：**

- 累積 50+ 篇評分文章
- 分析高分文章的共同特徵
- 準備 few-shot learning 資料

**長期（下月）：**

- 使用高分文章改進 AI prompt
- 實施 A/B 測試比較新舊 prompt
- 建立自動品質過濾機制

---

## 🔐 安全提醒

- ✅ API Key 已設定在 `.env.local`
- ⚠️ 不要將 API Key 提交到 Git
- ⚠️ 生產環境需要使用不同的 API Key
- ⚠️ 刪除操作無法復原，請謹慎使用

---

## 📚 完整文檔

- **本檔案** - 快速開始
- `/docs/admin-api-usage.md` - 完整 API 文檔
- `/docs/ADMIN_API_SUMMARY.md` - 功能總覽
- `/docs/DEPLOYMENT.md` - 生產環境部署

---

**現在就開始使用吧！** 🚀

建議從 Postman 開始，熟悉後再考慮使用 curl 進行批量操作。
