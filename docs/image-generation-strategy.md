# 🖼️ 智能圖片生成策略

**目標**: 在保持視覺品質的同時，最小化 DALL-E 3 使用成本

---

## 💰 成本背景

### DALL-E 3 定價
- **Size**: 1792x1024 (橫向封面)
- **Quality**: Standard
- **成本**: **$0.080/張**

### 與 Gemini 文字生成對比
| 項目 | 成本 | 比例 |
|------|------|------|
| Gemini 生成 1 篇文章 | $0.000675 | 1x |
| DALL-E 3 生成 1 張圖 | $0.080 | **118x** |

**關鍵洞察**: 生成 1 張圖片 = 生成 118 篇文章的成本！

---

## 📊 成本估算

假設每次生成 60 篇文章：

| 無圖文章比例 | AI 圖片使用 | 每次成本 | 每月成本 | 優化策略成本 | 節省 |
|------------|-----------|---------|---------|------------|------|
| 5% | 3 張 | $0.24 | $14.40 | $0.05 | 79% |
| 10% | 6 張 | $0.48 | $28.80 | $0.10 | 79% |
| 20% | 12 張 | $0.96 | $57.60 | $0.19 | 80% |
| 30% | 18 張 | $1.44 | $86.40 | $0.29 | 80% |

**優化策略**: 只為高價值文章 (~20% 的無圖文章) 生成 AI 圖片

---

## 🎯 優化策略

### 三層圖片優先級

```typescript
// 1. 優先使用來源圖片 (成本: $0)
if (generated.coverImage || storedImages.length > 0) {
  coverImage = storedImages[0].url
}

// 2. 智能判斷是否生成 AI 圖片
else if (sourceImages.length === 0) {
  const shouldGenerateAI = (
    generated.confidence >= 85 &&           // 高信心度
    generated.quality_checks.has_data &&    // 有數據支撐
    generated.categories.some(cat =>        // 重要類別
      ['新車', '評測', '電動車'].includes(cat)
    )
  )

  if (shouldGenerateAI) {
    // 生成 AI 圖片 (成本: $0.08)
  } else {
    // 跳過，使用預設圖 (成本: $0)
  }
}
```

### 高價值文章判定標準

必須**同時滿足**以下三個條件：

1. **高信心度**: `confidence >= 85`
   - 確保是高質量文章
   - 值得投資視覺資源

2. **有數據支撐**: `has_data = true`
   - 內容充實，有具體數據
   - 更有可能吸引讀者

3. **重要類別**: 屬於以下之一
   - **新車**: 新車發表、上市
   - **評測**: 試駕報告、性能測試
   - **電動車**: EV 相關新聞（熱門話題）

### 低價值文章處理

對於不符合條件的文章：
- ✅ **不生成 AI 圖片**
- ✅ **使用預設佔位圖** (可在前端實現)
- ✅ **或使用品牌 Logo** (可從品牌資料庫取得)

---

## 📈 預期效果

### 假設場景
- 每次生成 60 篇文章
- 10% 文章沒有來源圖片 (6 篇)
- 優化前: 6 篇全部生成 AI 圖

### 優化前
```
無圖文章: 6 篇
AI 圖片生成: 6 張
成本: 6 × $0.08 = $0.48/次
月成本: $0.48 × 60 = $28.80
```

### 優化後
```
無圖文章: 6 篇
高價值文章: ~1-2 篇 (約 20%)
AI 圖片生成: 1-2 張
成本: 1.5 × $0.08 = $0.12/次
月成本: $0.12 × 60 = $7.20
```

### 成本節省
- **每次節省**: $0.36 (-75%)
- **每月節省**: $21.60 (-75%)
- **年度節省**: $259.20

---

## 🎨 前端處理建議

對於沒有封面圖的文章，前端可以：

### 1. 品牌 Logo 佔位圖
```tsx
{article.coverImage ? (
  <img src={article.coverImage} alt={article.title} />
) : (
  <div className="brand-placeholder">
    <BrandLogo brand={article.brands[0]} />
  </div>
)}
```

### 2. 漸變色背景 + 品牌名
```tsx
<div className="gradient-placeholder" style={{
  background: `linear-gradient(135deg, ${getBrandColor(brand)} 0%, ${getLightColor(brand)} 100%)`
}}>
  <h3>{article.brands[0]}</h3>
</div>
```

### 3. 圖示 + 分類
```tsx
<div className="category-placeholder">
  <CategoryIcon category={article.categories[0]} />
  <span>{article.categories[0]}</span>
</div>
```

---

## 📊 監控指標

部署後需要追蹤：

### 1. AI 圖片使用率
```sql
SELECT
  COUNT(*) FILTER (WHERE image_credit LIKE '%DALL-E%' OR image_credit LIKE '%AI Generated%') as ai_images,
  COUNT(*) as total_articles,
  ROUND(100.0 * COUNT(*) FILTER (WHERE image_credit LIKE '%DALL-E%' OR image_credit LIKE '%AI Generated%') / COUNT(*), 2) as percentage
FROM generated_articles
WHERE created_at > NOW() - INTERVAL '7 days';
```

### 2. 成本追蹤
- 每日 DALL-E API 使用量
- 月度圖片生成成本
- 與目標成本的差異

### 3. 用戶體驗
- 無圖文章的點擊率
- 有 AI 圖 vs 無圖的參與度對比
- 跳出率變化

---

## 🔧 進階優化選項

如果未來需要進一步降低成本：

### 選項 1: 切換到 Stable Diffusion
- **成本**: ~$0.004/張 (便宜 95%)
- **平台**: Replicate API
- **整合**: 需要 1-2 天開發

### 選項 2: 完全依賴來源圖片
- **成本**: $0
- **風險**: 部分文章無圖
- **緩解**: 優化爬蟲圖片抓取率

### 選項 3: 使用 Gemini Vision 選圖
- **成本**: ~$0.0001/篇 (便宜 99.9%)
- **功能**: 用 Gemini 從多張候選圖中選最佳
- **價值**: 提升圖片品質

---

## ✅ 已實現的優化

1. ✅ **只在完全無圖時才生成**
   - 優先使用來源圖片
   - DALL-E 作為最後手段
   - 可通過環境變數控制

2. ✅ **環境變數控制**
   - `ENABLE_AI_IMAGE_GENERATION=true` (默認啟用)
   - 設為 `false` 可關閉 AI 圖片生成

3. ✅ **成本意識的 logging**
   - 明確標示 AI 圖片成本 ($0.08)
   - 記錄圖片來源和處理結果

4. ✅ **使用 Standard 品質**
   - 而非 HD (節省 33%)
   - 品質仍然足夠

5. ✅ **修復工具**
   - `scripts/fix-missing-covers.ts`
   - 為現有無圖文章補充 AI 封面

---

## 📋 總結

### 當前策略
```
完全依賴來源圖片
    ↓ 如果無圖
判斷是否為高價值文章
    ↓ 是
生成 AI 圖片 ($0.08)
    ↓ 否
跳過 AI 生成 ($0)
```

### 預期成本
- **優化前**: ~$28.80/月 (假設 10% 無圖)
- **優化後**: ~$7.20/月 (只為 20% 高價值無圖文章生成)
- **節省**: **$21.60/月 (75%)**

### 與文字生成成本對比
- Gemini 文字: $2.46/月 (60 篇 × 2 次/天)
- DALL-E 圖片: $7.20/月 (優化後)
- **比例**: 圖片成本佔 75% → 仍是最大成本項

**下一步**: 如果成本仍然偏高，考慮切換到 Stable Diffusion ($1.50/月)
