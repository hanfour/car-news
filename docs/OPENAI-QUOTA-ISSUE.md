# 🚨 OpenAI API 配額問題修復指南

## 問題診斷

### 症狀
- ✅ Vercel Cron 正常執行
- ✅ 代碼配置正確
- ❌ 但沒有新文章生成

### 根本原因

從 Vercel 日誌發現（2025-12-01 00:00:45）：

```
Error: 429 You exceeded your current quota, please check your plan and billing details.
code: 'insufficient_quota'
```

**問題**: OpenAI Embeddings API 配額用完，導致整個 Generator 流程失敗。

### 為什麼需要 Embeddings？

Generator 使用 OpenAI Embeddings API (`text-embedding-3-small`) 來：
1. 為源文章生成向量表示
2. 使用余弦相似度進行文章聚類
3. 避免生成重複或過於相似的文章

**成本**: 每 1M tokens 約 $0.02（非常便宜但有配額限制）

---

## 緊急修復方案

### 方案 A: 臨時禁用 Embeddings（已實現）✅

**步驟 1**: 在 Vercel 添加環境變量

1. 訪問 Vercel Dashboard
2. 進入項目 Settings → Environment Variables
3. 添加新變量：
   ```
   Name: DISABLE_EMBEDDINGS
   Value: true
   ```
4. 選擇適用環境：Production, Preview, Development
5. 保存

**步驟 2**: 重新部署

- Vercel 會自動重新部署（約 2-3 分鐘）
- 或手動觸發：Deployments → Redeploy

**效果**:
- ✅ Generator 可以繼續運行
- ✅ 文章正常生成
- ⚠️  無法使用 embedding 聚類（去重能力降低）

### 方案 B: 充值 OpenAI API

**成本**:
- 最低充值: $5
- 預估使用量:
  - 每次執行處理 ~650 篇源文章
  - 每天 24 次 = ~15,600 篇
  - 每篇約 500 tokens
  - 總計: 15,600 × 500 = 7.8M tokens/天
  - 成本: 7.8 × $0.02 = **$0.16/天** ≈ **$5/月**

**步驟**:
1. 訪問 https://platform.openai.com/account/billing
2. 添加付款方式
3. 充值 $5-$10
4. 等待配額恢復
5. 在 Vercel 移除 `DISABLE_EMBEDDINGS` 環境變量

---

## 長期解決方案

### 選項 1: 使用免費替代方案

**切換到本地 Embeddings**（無 API 費用）：
```bash
# 使用 Sentence Transformers（免費）
npm install @xenova/transformers
```

優點：
- ✅ 完全免費
- ✅ 無配額限制

缺點：
- ⚠️  需要更多計算資源
- ⚠️  可能增加執行時間

### 選項 2: 使用 Gemini Embeddings

Gemini 也提供 embeddings API：
```bash
# Gemini Embeddings
Model: text-embedding-004
Cost: 免費（每分鐘 1,500 次請求）
```

優點：
- ✅ 免費額度更大
- ✅ 與現有 Gemini 集成一致

缺點：
- ⚠️  需要修改代碼

### 選項 3: 基於標題的簡單去重

不使用 embeddings，改用：
- 標題相似度（Levenshtein distance）
- 主題哈希（已實現）
- 發布時間窗口

優點：
- ✅ 完全免費
- ✅ 執行速度快

缺點：
- ⚠️  去重效果較差

---

## 當前狀態

### 已實現
✅ `DISABLE_EMBEDDINGS` 環境變量開關
✅ 代碼已提交並部署（Commit: 98000f5）

### 待執行
⏳ 在 Vercel 添加 `DISABLE_EMBEDDINGS=true`
⏳ 等待自動重新部署
⏳ 驗證 Generator 是否正常運行

---

## 驗證步驟

### 1. 確認環境變量已添加

```bash
# 檢查 Vercel 環境變量
vercel env ls
# 應該看到 DISABLE_EMBEDDINGS = true
```

### 2. 等待下一個整點執行

當前時間: 檢查時間
下次執行: XX:00（每小時）

### 3. 檢查日誌

```bash
# 查看最近的執行日誌
vercel logs --since 10m | grep "DISABLE_EMBEDDINGS"

# 應該看到:
# ⚠️  Embeddings generation is disabled (DISABLE_EMBEDDINGS=true)
```

### 4. 驗證文章生成

```bash
# 運行診斷腳本
npx tsx scripts/check-recent-articles.ts

# 預期:
# ✅ 10 篇新文章（今天的日期）
# ✅ 全部有封面圖
```

---

## FAQ

### Q1: 禁用 embeddings 會有什麼影響？

**A**:
- ✅ **好處**: Generator 可以正常運行
- ⚠️  **影響**: 聚類去重能力降低，可能偶爾生成相似文章
- 📊 **實際**: 由於我們已有主題哈希去重，影響不大

### Q2: 需要永久禁用 embeddings 嗎？

**A**: 不需要。這是**臨時解決方案**：
1. 立即解決問題（今天有文章產出）
2. 有空時充值 OpenAI ($5/月) 或切換到 Gemini
3. 移除 `DISABLE_EMBEDDINGS` 環境變量

### Q3: 為什麼 OpenAI 配額會用完？

**A**: 可能原因：
1. 免費 tier 已過期
2. 達到月度限制
3. 信用卡付款失敗

查看: https://platform.openai.com/account/usage

### Q4: 禁用 embeddings 後，去重還能工作嗎？

**A**: 是的！我們還有其他去重機制：
- ✅ 主題哈希（基於標題）
- ✅ URL 去重
- ✅ 發布時間過濾（避免舊文章）
- ✅ 高級去重檢查（`comprehensiveDuplicateCheck`）

只是少了基於 embedding 的語義相似度檢查。

---

## 推薦行動計劃

### 立即（今天）
1. ✅ 代碼已部署
2. ⏳ **你需要做**: 在 Vercel 添加 `DISABLE_EMBEDDINGS=true`
3. ⏳ 等待下一個整點（XX:00）
4. ⏳ 驗證文章生成

### 短期（本週）
- 決定長期方案：
  - 充值 OpenAI ($5/月)
  - 或切換到 Gemini Embeddings（免費）
  - 或完全移除 embeddings（簡化系統）

### 長期（下月）
- 監控 OpenAI 使用量
- 評估 embeddings 的實際效果
- 考慮切換到本地 embeddings（成本優化）

---

## 監控和警報

### 建議添加監控

```typescript
// 在 Generator 中添加警報
if (error.code === 'insufficient_quota') {
  // 發送警報郵件或 Slack 通知
  await sendAlert('OpenAI API quota exceeded!')
}
```

### Vercel Log Drains

配置日誌轉發到：
- Datadog
- Logtail
- 自定義 webhook

可以在配額用完時立即收到通知。

---

**建立時間**: 2025-11-30
**狀態**: 等待在 Vercel 添加環境變量
**預計修復時間**: < 5 分鐘（添加環境變量後）
