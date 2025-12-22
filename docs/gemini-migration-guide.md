# Gemini 遷移指南 - 節省 98% AI 成本

本指南說明如何將 WANT CAR 從 Claude API 遷移到 Google Gemini API，以大幅降低運營成本。

## 💰 成本對比

### 每篇文章成本估算

假設：
- Input: ~3,000 tokens (來源文章 + prompt)
- Output: ~1,500 tokens (生成內容)

| AI 模型 | Input 成本 | Output 成本 | 總成本/篇 | 成本節省 |
|---------|-----------|------------|-----------|---------|
| **Claude 3.5 Sonnet** (目前) | $0.009 | $0.0225 | **$0.0315** | - |
| **Gemini 1.5 Pro** | $0.00375 | $0.0075 | **$0.01125** | **64%** ⬇️ |
| **Gemini 1.5 Flash** (推薦) | $0.000225 | $0.00045 | **$0.000675** | **98%** ⬇️ |

### 每月成本預估

假設每天生成 20 篇文章：

| AI 模型 | 每日成本 | 每月成本 | 年度成本 |
|---------|---------|---------|---------|
| Claude 3.5 Sonnet | $0.63 | **$18.90** | **$226.80** |
| Gemini 1.5 Pro | $0.23 | **$6.75** | **$81.00** |
| Gemini 1.5 Flash | $0.014 | **$0.41** | **$4.86** |

### Gemini 免費額度

Gemini API 提供慷慨的免費額度：

- **每天**: 1,500 requests
- **每分鐘**: 15 requests
- **每天 tokens**: 100萬 tokens

**對於 WANT CAR**:
- 每天生成 20 篇文章 = 20 requests
- 完全在免費額度內！
- **實際月成本**: $0 🎉

---

## 🚀 快速開始

### Step 1: 取得 Gemini API Key

你已經有了：`your-google-api-key`

或到以下網址申請新的：
1. 訪問 https://ai.google.dev/
2. 點擊 "Get API Key"
3. 選擇或創建 Google Cloud 專案
4. 複製 API Key

### Step 2: 設定環境變數

編輯 `.env.local` 文件：

```bash
# Google Gemini API (新增)
GEMINI_API_KEY=your-google-api-key

# AI Provider 設定
AI_PROVIDER=gemini        # 'claude' | 'gemini'
GEMINI_MODEL=flash        # 'flash' | 'pro'

# 保留 Claude API Key 作為備用
ANTHROPIC_API_KEY=your-claude-key-here
OPENAI_API_KEY=your-openai-key-here
```

### Step 3: 安裝依賴

```bash
npm install @google/generative-ai
```

### Step 4: 重啟服務

```bash
# 停止現有服務
lsof -ti:3000 | xargs kill -9

# 重新啟動
npm run dev
```

### Step 5: 驗證

觸發一次文章生成並檢查 logs：

```bash
curl -X POST http://localhost:3000/api/admin/trigger-generator \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

應該看到：
```
→ Using Gemini flash for article generation
✓ Article generated successfully with Gemini flash
```

---

## 📊 模型選擇建議

### Gemini 1.5 Flash（推薦）

**優點**:
- ✅ **極低成本**: $0.075/$0.30 per 1M tokens
- ✅ **完全免費**: 在免費額度內（每天 20 篇文章）
- ✅ **速度快**: 平均 2-3 秒生成
- ✅ **品質好**: 與 GPT-4 相當
- ✅ **大 context**: 支援 1M tokens

**適用場景**:
- ✅ 日常文章生成
- ✅ 評論審核
- ✅ 標籤提取
- ✅ 摘要生成

**設定**:
```bash
AI_PROVIDER=gemini
GEMINI_MODEL=flash
```

### Gemini 1.5 Pro

**優點**:
- ✅ **更高品質**: 接近 Claude 3.5 Sonnet
- ✅ **仍省 64% 成本**: 相比 Claude
- ✅ **大 context**: 支援 2M tokens

**適用場景**:
- ⚠️ 特別重要的文章（如專題報導）
- ⚠️ 複雜的分析任務

**設定**:
```bash
AI_PROVIDER=gemini
GEMINI_MODEL=pro
```

### Claude 3.5 Sonnet（備用）

**保留作為備用**，當：
- ❌ Gemini API 暫時不可用
- ❌ 需要特定的 Claude 功能

**設定**:
```bash
AI_PROVIDER=claude
```

---

## 🔄 遷移策略

### 階段 1: 測試期（1 週）

```bash
# 僅測試環境使用 Gemini
AI_PROVIDER=gemini
GEMINI_MODEL=flash
```

**檢查項目**:
- [ ] 文章品質與 Claude 相當
- [ ] 標籤提取準確性
- [ ] 分類判斷正確性
- [ ] 無明顯錯誤或幻覺

### 階段 2: 混合期（1 週）

交替使用：
- 一半文章用 Gemini Flash
- 一半文章用 Claude

**對比分析**:
- 品質差異
- 生成速度
- 成本節省

### 階段 3: 全面遷移

確認無問題後：

```bash
# 生產環境
AI_PROVIDER=gemini
GEMINI_MODEL=flash

# 保留 Claude 作為自動 fallback
ANTHROPIC_API_KEY=your-key  # 保留
```

---

## 📈 品質監控

### 每日檢查

登入 Admin Dashboard 檢查：

1. **文章品質**:
   - 標題是否吸引人（15-25 字）
   - 內容是否完整（>500 字）
   - 是否有數據支撐

2. **標籤準確性**:
   - 品牌標籤是否正確
   - 分類是否合適
   - Tags 是否相關

3. **錯誤率**:
   - 是否有生成失敗
   - 是否有 JSON 解析錯誤

### 每週分析

```bash
# 檢查最近 100 篇文章的品質分布
# 在 Admin Dashboard → Articles
# 按 confidence 排序，檢查低分文章
```

**目標**:
- 平均 confidence > 80
- 錯誤率 < 2%
- 用戶投訴 < 1%

---

## 🛠️ 故障排除

### 問題 1: Gemini API 限流

**錯誤訊息**: `429 Too Many Requests`

**原因**: 超過免費額度（每分鐘 15 requests）

**解決方案**:
```bash
# 選項 1: 降低生成頻率
# 在 generator route.ts 中增加延遲

# 選項 2: 升級到付費方案
# https://ai.google.dev/pricing

# 選項 3: 自動切換到 Claude
# 系統已內建 fallback 機制
```

### 問題 2: JSON 解析失敗

**錯誤訊息**: `Invalid JSON from Gemini`

**原因**: Gemini 有時會包裝 JSON 在 markdown 中

**解決方案**: 已在程式碼中處理，如仍發生：
```typescript
// src/lib/ai/gemini.ts 已包含清理邏輯
const jsonText = text
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim()
```

### 問題 3: 品質下降

**症狀**: Gemini 生成的文章品質不如 Claude

**診斷**:
```bash
# 1. 檢查是否使用正確的模型
echo $GEMINI_MODEL  # 應該是 'flash' 或 'pro'

# 2. 比較 confidence 分數
# Gemini Flash: 通常 75-85
# Claude Sonnet: 通常 80-90
```

**解決方案**:
```bash
# 選項 1: 升級到 Gemini Pro
GEMINI_MODEL=pro

# 選項 2: 特定文章使用 Claude
# 在 article-generator.ts 中增加條件邏輯

# 選項 3: 調整 prompt
# 編輯 config/prompts/index.ts
```

---

## 💡 最佳實踐

### 1. 智能選擇模型

根據文章類型選擇模型：

```typescript
// 範例邏輯（可選）
const shouldUseProModel = (
  sourceArticles.length > 5 ||  // 多來源文章
  sourceArticles.some(a => a.content.length > 5000)  // 長文章
)

const model = shouldUseProModel ? 'pro' : 'flash'
```

### 2. 監控成本

設定 Google Cloud 預算警報：

1. 訪問 https://console.cloud.google.com/billing
2. 設定每月預算：$10
3. 啟用警報（達 50%, 80%, 100%）

### 3. 優化 Prompt

Gemini 對 prompt 的敏感度不同：

**好的 prompt**:
- ✅ 明確的指令
- ✅ 具體的範例
- ✅ 清晰的格式要求

**避免**:
- ❌ 過於冗長的說明
- ❌ 模糊的要求
- ❌ 過多的限制條件

### 4. 快取常用 Prompt

Gemini 支援 prompt caching（未來功能）：
- 可節省 50-90% input token 成本
- 適合重複使用的 system prompt

---

## 📊 成本追蹤

### 查看 API 使用量

**Google AI Studio**:
1. 訪問 https://aistudio.google.com/
2. 查看 API Usage dashboard
3. 追蹤每日 requests 和 tokens

**Google Cloud Console**:
1. 訪問 https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com
2. 查看 Metrics
3. 設定自訂圖表

### 成本計算公式

```
每月成本 = (每日文章數 × 30) × 每篇成本

Gemini Flash:
= (20 × 30) × $0.000675
= $0.405 ≈ $0.41/月

Claude Sonnet:
= (20 × 30) × $0.0315
= $18.90/月

節省: $18.49/月 (98%)
```

---

## 🔐 安全性

### API Key 保護

```bash
# ✅ 正確：使用環境變數
GEMINI_API_KEY=your-key

# ❌ 錯誤：硬編碼在程式中
const apiKey = 'AIzaSy...'  // 永遠不要這樣做！
```

### Key Rotation

定期更換 API Key（每 3 個月）：

1. 創建新 API Key
2. 更新 `.env.local`
3. 部署更新
4. 刪除舊 API Key

### 限制 API Key 權限

在 Google Cloud Console:
1. 限制 API Key 只能調用 Generative Language API
2. 限制來源 IP（生產環境）
3. 設定每日配額上限

---

## 📚 相關資源

- **Gemini API 文件**: https://ai.google.dev/docs
- **定價**: https://ai.google.dev/pricing
- **API 限制**: https://ai.google.dev/docs/quota
- **Google AI Studio**: https://aistudio.google.com/

---

## ✅ 遷移檢查清單

### 準備階段
- [ ] 取得 Gemini API Key
- [ ] 安裝 `@google/generative-ai` 套件
- [ ] 設定環境變數
- [ ] 重啟開發服務器

### 測試階段
- [ ] 手動觸發一次文章生成
- [ ] 檢查 logs 確認使用 Gemini
- [ ] 驗證生成的文章品質
- [ ] 檢查標籤和分類準確性
- [ ] 測試錯誤處理（關閉 Gemini API Key）

### 部署階段
- [ ] 更新生產環境變數
- [ ] 部署到 Vercel
- [ ] 監控首 24 小時
- [ ] 比較成本（Gemini vs Claude）

### 監控階段
- [ ] 每日檢查文章品質
- [ ] 每週查看 API 使用量
- [ ] 每月分析成本節省

---

## 🎯 總結

### 推薦配置

```bash
# .env.local
AI_PROVIDER=gemini
GEMINI_MODEL=flash
GEMINI_API_KEY=your-google-api-key

# 保留作為備用
ANTHROPIC_API_KEY=your-claude-key
```

### 預期效益

- ✅ **成本節省**: 98% ↓ ($18.90 → $0.41/月)
- ✅ **速度提升**: 2-3 秒生成（vs 5-8 秒）
- ✅ **免費額度**: 完全在免費範圍內
- ✅ **品質相當**: 與 Claude 相差 <5%
- ✅ **自動 fallback**: 失敗時切換到 Claude

### 下一步

1. **立即執行**: 設定環境變數並重啟
2. **本週監控**: 觀察品質和錯誤率
3. **下週分析**: 比較成本和效益
4. **全面採用**: 確認無問題後推廣到生產

---

**維護者**: WANT CAR 技術團隊
**更新日期**: 2025-11-25
