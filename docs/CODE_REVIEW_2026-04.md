# car-news-ai 專案 Code Review（2026-04-24）

> Reviewer: Claude (Opus 4.7, senior engineer)
> Branch: `fix/security-optimization-audit`
> 範圍: 架構、安全、效能、程式碼品質、DX、測試

## 總評：7/10

功能完整、架構尚合理、近期已做過一輪安全修復。但**測試覆蓋近乎為零、DX 基礎設施缺失、幾個大檔與 AI 抽象層需重構**。以下依優先度排序。

---

## 🔴 P0 — 必須立刻修的問題

### 1. 對話 API 的 IDOR 漏洞（嚴重）
- **位置**：`src/app/api/messages/conversations/[id]/messages/route.ts:26-35` 的 GET、以及 `:123-163` 的 DELETE
- **症狀**：只驗 session 登入，**未驗證該 user 是否為此 conversation 的 participant**。任何登入者知道 conversation UUID 就能讀/刪他人私訊。
- **修法**：進入 handler 第一件事先查 `conversation_participants` 表確認成員身份，再做任何 I/O。

### 2. `/api/debug/*` 13 個端點在 production 裸奔
- **路徑**：`src/app/api/debug/{reset, cleanup-duplicates, check-database, fix-categories, normalize-categories, verify-migration, …}`
- **風險**：看名字就知道 `reset`、`cleanup-duplicates` 能直接毀資料。
- **修法**：全部包一層 `if (process.env.NODE_ENV === 'production') return 404`，或移到只有管理員可觸發的 `/api/admin/` 並套上 admin 身份驗證。

### 3. Cron 驗證是 non-timing-safe 比對
- **位置**：`src/app/api/cron/generator/route.ts:44` `authHeader === \`Bearer ${CRON_SECRET}\``
- **備註**：`src/lib/admin/auth.ts` 已有 `secureCompare()`，直接套用即可。同時建議：因 Vercel Edge 不一定會剝除 `x-vercel-cron` header，manual trigger 路徑應為唯一入口。

---

## 🟠 P1 — 高影響的優化

### 4. 測試覆蓋率 <0.3%
- 全專案只有 `src/config/__tests__/categories.test.ts` 一支測試；`/api/*`、auth、AI 呼叫、scraper **零測試**。
- 建議最低標：先替 `cron/generator`、`lib/generator/`、`lib/ai/claude.ts` 與 `gemini.ts` 的純邏輯函數補單元測試；API routes 用 `supertest` 或 Next 的 request/response mock 做整合測試；jest coverage threshold 設 30% 起步逐步提升。

### 5. AI Provider 沒有抽象層
- `src/lib/ai/claude.ts` 和 `gemini.ts` 各自定義 `GenerateArticleOutput`、標籤提取邏輯重複約 100 行；`lib/generator/article-generator.ts:8-9` 用 `process.env.AI_PROVIDER` 硬選。
- 建議：抽出 `IArticleGenerator` 介面 + 一個 factory，將「模型可用性偵測、retry、timeout、usage logging」統一到 wrapper 層。未來要加 fallback（Claude 失敗 → Gemini）才不會到處改。

### 6. 巨型檔案拆分

| 檔案 | 行數 | 建議 |
|---|---|---|
| `src/app/api/cron/generator/route.ts` | 684 | 抽 `steps/` — cluster、generate、image、publish |
| `src/components/StickyHeader.tsx` | 641 | 拆 `HeaderNav`、`HeaderSearch`、`UserMenu` |
| `src/components/CommentItem.tsx` | 626 | 抽 `useCommentState`、`CommentActions`、`CommentEditor` |
| `src/lib/ai/flux-image-generation.ts` | 620 | 分 `prompt-builder`、`fal-client`、`post-process` |

### 7. N+1 查詢 — 對話列表
- `src/app/api/messages/conversations/route.ts:20-77` 連查 3 次再手動 map profiles。
- 建議寫 Postgres function（`get_conversations_with_profiles(user_id)`）或用 PostgREST embed 語法。

### 8. Generator cron 容易超時
- `maxDuration = 300`、目標 15 篇、每篇估 35s = 525s，本來就擦邊；加上 `image-downloader.ts:184` 的 `Promise.allSettled` 對圖片**無並發限制**、RSS scraper 無 timeout。
- 修法：圖片下載用 p-limit 控制 3 並發；`parseRSSFeed` 每個 source 包一層 15s timeout（`Promise.race`）。

---

## 🟡 P2 — 品質與 DX

### 9. DX 工具鏈缺口
- ❌ 無 Prettier、無 Husky pre-commit、無 `.github/workflows/`、`package.json` 缺 `typecheck`、`lint:fix`、`format`。
- 建議 scripts：
  ```json
  "typecheck": "tsc --noEmit",
  "lint:fix": "eslint --fix .",
  "format": "prettier --write .",
  "verify": "npm run typecheck && npm run lint && npm test"
  ```
- CI 用 GitHub Actions 跑 `verify` + `next build`，PR 必過才能 merge。

### 10. 無結構化日誌
- 全專案 655 處 `console.log`，生產環境無法追蹤 AI 失敗、cron 錯誤。
- 建議：建 `src/lib/logger.ts`（JSON 格式輸出給 Vercel Log Drains），同時整合 Sentry 做異常告警。

### 11. Client component 過度使用
- 35 處 `'use client'`；`src/app/messages/[conversationId]/page.tsx` 整頁 CSR。
- 建議：僅把需要互動的子元件標 `'use client'`，page 層維持 Server Component。

### 12. 快取策略不完整
- 僅首頁/分類/品牌頁有 `revalidate = 60`；`[year]/[month]/[id]/page.tsx` 詳情頁沒快取，每次都 SSR。
- 建議：詳情頁加 `export const revalidate = 3600`；feed、sitemap 加 `Cache-Control: s-maxage=300`。

### 13. `AuthContext` useEffect 訂閱未清理
- `src/contexts/AuthContext.tsx:59-80` — `onAuthStateChange` 沒 unsubscribe，且 `[supabase]` 依賴會讓它重掛。
- 修法：依賴改 `[]`，return 內呼 `subscription.unsubscribe()`。

### 14. Bundle 可能污染
- `axios`、`cheerio`、`rss-parser`、`@anthropic-ai/sdk` 只該在 server 端用；建議 `next.config.ts` 的 `serverExternalPackages` 明確宣告，並把 scraper/AI 模組加上 `import 'server-only'` 檔頭防呆。

---

## 🟢 P3 — 清理工作

### 15. 根目錄技術債
- 15 個 `.md`（COMPLETE、DEPLOYMENT_SUCCESS、MIGRATION_FIXED、UPGRADE_TO_V2_COMPLETED、OPTIMIZATION_SUMMARY…）多為一次性筆記，建議移到 `docs/archive/` 只保留 README。
- `.env.vercel-check`、`.env.vercel-prod`、`.env.vercel-prod-pull`、`.env.vercel.production` — 4 份疑似殘留（已被 `.env*` gitignore 蓋住沒外洩，但本機混亂），建議刪剩一份 `.env.production.example`。
- `.playwright-mcp/`、`supabase/.temp/` 應加進 `.gitignore`。
- `SETUP_FIRST_ADMIN.sql`、`check-images.js`、`test-local.sh` 移到 `scripts/`。

### 16. DB 欄位與 JS 命名不一致
- DB `snake_case`、JS 物件也直接用 snake_case（`created_at` 等），部份 type 又是 camelCase — 不一致。
- 建議：在 Supabase query wrapper 統一轉 camelCase（或反之），業務層單一命名風格。

### 17. 狀態管理無快取層
- 73 個 client component、自刻 `useState + useEffect + fetch`，每次 mount 重打 API。
- 建議：導入 SWR 或 TanStack Query，至少把 `articles`、`profile`、`notifications` 這類常用 query 收斂。

---

## 建議執行順序

1. **本週**：修 IDOR（#1）、關閉 debug routes（#2）、cron timing-safe（#3）、圖片並發限制 + RSS timeout（#8）
2. **本月**：補 critical path 測試（#4）、拆大檔（#6）、加 Prettier/Husky/CI（#9）、logger + Sentry（#10）
3. **下月**：AI 抽象層重構（#5）、N+1 查詢（#7）、client/server 切分 + 快取（#11、#12）、狀態管理收斂（#17）
4. **有空時**：清理文件與殘留 env（#15）、命名統一（#16）
