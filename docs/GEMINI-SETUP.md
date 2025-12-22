# 🚀 Gemini 快速設定 - 節省 98% AI 成本

## ⚡ 快速開始（5 分鐘）

### 1. 新增環境變數

編輯 `.env.local`:

```bash
# Google Gemini API (使用 Gemini 2.5 模型)
GEMINI_API_KEY=your-google-api-key-here

# 啟用 Gemini
AI_PROVIDER=gemini
GEMINI_MODEL=flash    # 使用 Gemini 2.5 Flash（最省錢）

# 保留 Claude 作為備用
ANTHROPIC_API_KEY=your-claude-key-here
```

### 2. 測試連接

```bash
npx tsx scripts/test-gemini.ts
```

應該看到：
```
✅ 所有測試通過！
預期成本節省: 98% (每月 $0.41 vs $18.90)
```

### 3. 重啟服務

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### 4. 驗證

觸發文章生成，檢查 logs：

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

## 💰 成本對比

| 模型 | 每篇成本 | 每月成本 (20篇/天) | 節省 |
|------|---------|-------------------|------|
| **Claude 3.5 Sonnet** | $0.0315 | $18.90 | - |
| **Gemini 2.5 Flash** | $0.000675 | $0.41 | **98%** ⬇️ |

**實際成本**: $0/月（在免費額度內）

---

## ✅ 優點

- ✅ **成本極低**: 98% 成本節省
- ✅ **免費額度**: 每天 1,500 requests（完全夠用）
- ✅ **速度快**: 2-3 秒生成（vs Claude 5-8 秒）
- ✅ **品質好**: 與 Claude 相當（<5% 差異）
- ✅ **自動備援**: 失敗時自動切換到 Claude

---

## 📚 完整文件

- **遷移指南**: `docs/gemini-migration-guide.md`
- **測試腳本**: `scripts/test-gemini.ts`

---

## 🔧 故障排除

### API Key 錯誤
```bash
# 檢查 API Key 是否設定
echo $GEMINI_API_KEY
```

### 測試失敗
```bash
# 查看詳細錯誤
npx tsx scripts/test-gemini.ts 2>&1 | tee gemini-test.log
```

### 品質問題
```bash
# 切換到 Gemini 2.5 Pro 模型（成本仍省 64%）
GEMINI_MODEL=pro
```

---

**完成時間**: 5 分鐘
**成本節省**: 98%
**風險**: 低（自動 fallback）

**立即開始**: 編輯 `.env.local` → 測試 → 重啟 → 驗證 ✨
