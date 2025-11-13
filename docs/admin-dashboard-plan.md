# Admin Dashboard 設計方案

## 階段 1: 基礎文章管理 (立即實現)

### 功能列表

1. **文章列表** (`/admin/articles`)
   - 表格顯示所有文章(已發布/草稿)
   - 篩選: 品牌、分類、日期、confidence 範圍
   - 排序: 發布時間、confidence、瀏覽量
   - 快速操作: 發布/下架、編輯、刪除

2. **文章編輯** (`/admin/articles/[id]`)
   - 編輯標題、內容、分類、標籤
   - 調整 cover_image
   - 手動修改 confidence
   - 標記為「優質範例」(用於 few-shot learning)

3. **質量儀表板** (`/admin/dashboard`)
   - Confidence 分佈圖表
   - Quality checks 統計
   - 每日生成數量趨勢
   - 最受歡迎文章 Top 10

4. **Prompt 管理** (`/admin/prompts`)
   - 線上編輯 system.txt 和 style-guide.txt
   - 版本控制(保存歷史 prompt)
   - A/B 測試配置

## 階段 2: AI 優化機制 (進階)

### Few-Shot Learning

```typescript
// 在生成文章前,從「優質範例庫」中提取相似主題的文章
const examples = await getQualityExamples({
  brand: currentBrand,
  category: inferredCategory,
  limit: 2
})

// 將範例加入 prompt
const enhancedPrompt = `
${basePrompt}

以下是優質文章範例,請參考其風格和結構:

範例 1:
標題: ${examples[0].title_zh}
內容: ${examples[0].content_zh.slice(0, 500)}...

範例 2:
標題: ${examples[1].title_zh}
內容: ${examples[1].content_zh.slice(0, 500)}...

---

現在請基於以下來源文章生成新內容...
`
```

### Feedback Loop

1. **人工評分**
   - 管理員標記文章為: 優秀(5) / 良好(4) / 普通(3) / 差(2) / 極差(1)
   - 記錄評分原因(標籤): 標題不佳、內容空洞、數據錯誤、風格不符等

2. **自動分析**
   ```sql
   -- 找出高分文章的共同特徵
   SELECT
     brands,
     categories,
     AVG(LENGTH(content_zh)) as avg_length,
     AVG(confidence) as avg_confidence
   FROM generated_articles
   WHERE human_rating >= 4
   GROUP BY brands, categories
   ```

3. **Prompt 自動調整**
   - 根據高分文章特徵,動態調整 prompt
   - 例如: 發現高分文章平均 800 字,低分文章平均 400 字
   - → 在 prompt 中加入 "文章長度應在 700-900 字之間"

## 技術架構

### 認證系統
- 使用現有的 Supabase Auth
- 添加 `admin` role 到 profiles 表
- RLS 策略: 只有 admin 可以存取管理頁面

### 數據庫擴展

```sql
-- 文章評分表
CREATE TABLE article_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT REFERENCES generated_articles(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback_tags TEXT[],
  notes TEXT,
  rated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt 版本控制
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  style_guide TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- 優質範例標記
ALTER TABLE generated_articles
ADD COLUMN is_quality_example BOOLEAN DEFAULT FALSE,
ADD COLUMN human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5);
```

### UI 框架
- 使用 Tailwind CSS (已有)
- 添加 Shadcn/ui 或 Headless UI 組件庫
- Chart.js 或 Recharts 用於數據可視化

## 實現優先級

### P0 (立即實現)
- [ ] Admin 認證系統
- [ ] 文章列表頁面
- [ ] 基礎編輯功能
- [ ] 發布/下架操作

### P1 (一週內)
- [ ] 質量儀表板
- [ ] Prompt 線上編輯
- [ ] 文章評分系統

### P2 (兩週內)
- [ ] Few-shot 範例系統
- [ ] 自動化質量分析
- [ ] A/B 測試框架

## 成本效益分析

**投入**: 約 3-5 天開發時間
**收益**:
1. 快速識別和下架低質量文章
2. 通過範例學習持續提升 AI 輸出質量
3. 數據驅動的 prompt 優化
4. 減少人工審核時間(長期)

**Linus 評分**: 🟢 值得做
- 解決真實問題(文章質量參差不齊)
- 簡單實用(CRUD + 少量邏輯)
- 可迭代(先做基礎,再加 AI 優化)
