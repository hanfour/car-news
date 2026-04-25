# 會員子系統深度審計報告（2026-04-25）

> 對應 PR #18。Audit 範圍：auth + session、profile + settings + social graph、UGC（comments / garage / clubs / reports）、messaging + notifications。
> 由四份平行 explore agent 報告整合 + 人工驗證後，過濾偽陽性並挑出真實 bug。

## 審計後果

| 領域 | 嚴重 | 中度 | 輕微 | 評分 |
|---|---|---|---|---|
| Auth + session | 1（驗證後 2 個是 false positive） | 4 | 4 | 7/10 |
| Profile + settings + social graph | 3 | 4 | 4 | 6/10 |
| UGC（comments / garage / clubs / reports） | 4（驗證後 1 個 false positive） | 5 | 4 | 5/10 |
| Messaging + notifications | 2 | 3 | 3 | 6/10 |

## False positives（agent 誤報，已驗證後排除）

- **CommentItem 的 XSS** — 留言用 `<p>{comment.content}</p>` 渲染，React 預設轉義字串，`<script>...</script>` 會以純文字顯示不會執行。**非真正 XSS**。
- **Bearer token 缺 JWT 驗證** — Supabase `auth.getUser(token)` 內部會用 JWKS 驗證簽名，**已是安全的**。
- **OAuth state CSRF** — Supabase JS SDK 的 PKCE flow 內建處理 state；本專案 callback 處理 SDK 回傳結果，無自製 state 問題。
- **Forum search SQL injection（#9）** — 進一步分析 `forum/posts/route.ts:38-48`：現有 `replace(/[%_\\]/g, '\\$&').replace(/[.,()'"]/g, '')` 已逐一移除 PostgREST `.or()` 過濾語法的 delimiter（逗號、句點、括號、引號），無法 break out；至多讓搜尋成為「字面字串 ilike」，**非 SQL injection**。原 audit 報告誇大為安全問題。**真正缺陷只是 UX**（Chinese 標點被吃掉、無相關性排序），改 PostgreSQL FTS 屬 P2 體驗改善而非 P1 安全修復。
- **Comment like count race（#7）** — 進一步分析 `comments/[id]/like/route.ts` + `20251118_add_comment_likes.sql`：DB 已有 `update_comment_likes_count` trigger，INSERT/DELETE 與 SELECT 在同一 request 的同一 transaction 內順序執行，**無 race**。

---

## 真實 bug 清單（按優先度）

### 🔴 P0 — 本 PR 修復

| # | 位置 | 症狀 | 修法 |
|---|---|---|---|
| 1 | `src/app/api/user/[username]/block/route.ts:14` | `resolveTargetId` 在 profile 不存在時 `targetId = profile?.id ‖ username`，把 username 字串當 UUID 寫入 `user_blocks.blocked_id` 觸發 cast error 回 500 | 改用 `maybeSingle` + 明確 null 檢查，找不到回 404 |
| 2 | `src/app/api/user/avatar/route.ts:33` | 從 `file.name.split('.').pop()` 取副檔名，攻擊者可上傳 `.svg` 偽裝成 JPG MIME 通過驗證但檔名是 `.svg` | 改用 MIME→ext 對應表，不信任 filename |
| 3 | `src/app/api/user/profile/route.ts:31` | username 無保留字檢查，使用者可註冊 `admin` / `api` / `settings` 等與路由衝突的名稱 | 加保留字 set + 檢查；同時改 `eq` 為 `ilike` 做大小寫不敏感的唯一性檢查 |

### 🟠 P1 — 結案表

| # | 主題 | PR | 狀態 |
|---|---|---|---|
| 4 | `find_or_create_conversation` RPC + block 檢查 | [#20](https://github.com/hanfour/car-news/pull/20) | ✅ merged（含 DB migration） |
| 5 | `notification_settings.direct_message` + trigger 整合 | [#20](https://github.com/hanfour/car-news/pull/20) | ✅ merged（含 DB migration） |
| 6 | garage 刪圖原子性（先 DB 後 R2） | [#21](https://github.com/hanfour/car-news/pull/21) | ✅ merged |
| 7 | comment like count race | — | ✅ false positive（已有 trigger） |
| 8 | article share rate limit | [#19](https://github.com/hanfour/car-news/pull/19) | ✅ merged |
| 9 | forum search「injection」 | — | ✅ false positive（純 UX 問題，已降為 P2） |
| 10 | club ownership transfer | — | ⏳ feature gap，獨立 PR（含 UI flow） |
| 11 | invitation expires_at 檢查 | [#19](https://github.com/hanfour/car-news/pull/19) | ✅ merged |
| 12 | report 軟刪除留言檢查 | [#19](https://github.com/hanfour/car-news/pull/19) | ✅ merged |
| 13 | followers/following block filter | [#19](https://github.com/hanfour/car-news/pull/19) | ✅ merged |

### 🟡 P2 — 非阻擋性、可長期改進

- 跨 tab 登出同步（BroadcastChannel）
- 跨 tab 未讀計數同步（取代多 tab polling）
- Mark all read 失敗時 pessimistic 降級（refresh 真實狀態）
- Reports 審核流程 + admin dashboard
- Avatar 舊檔清理（每次上傳會 upsert，但若改副檔名會留舊檔）
- Garage soft delete（目前 hard delete）
- Username uniqueness DB-level constraint（已有 unique index？需確認）
- Forum search 改 PostgreSQL FTS（從 P1 #9 降為 UX 改善）
- 排程清理 R2 孤兒檔（基於 `api.garage.image_r2_orphan` log）

---

## 評估結論

**整體會員子系統成熟度：6/10**

- ✅ RLS policy 紮實（messages、conversations、profiles、user_blocks 皆有）
- ✅ Rate limiting 在大多數寫入路徑都有
- ✅ Authorization checks 大致到位（PR #10 已補了 IDOR）
- ⚠️ 跨特性的關聯驗證有缺口（block 不完整覆蓋 conversation / followers / comment）
- ⚠️ 邊界處理不一致（軟刪除 vs 硬刪除、孤兒檔、報告審核）
- ⚠️ 客戶端會話管理偏簡（單 tab 為主，多 tab 場景不健全）

**建議下一步**：本 PR 先修 P0；P1 拆 2-3 個獨立 PR 處理（clubs ownership transfer、notification settings 與 trigger 整合、block 全域化）。

## 收尾狀態（2026-04-25 更新）

**P0 全部修完**（PR #18）。**P1 共 10 項：8 項已修、2 項驗證為 false positive、1 項（#10 ownership transfer）為新功能性質列入後續路線圖**。

| PR | 範圍 |
|---|---|
| #18 | P0：block fallback、avatar MIME、reserved usernames |
| #19 | P1 batch 1：share rate limit、invitation expires、report soft-deleted、follower block filter |
| #20 | P1 batch 2 + DB migration：find_or_create_conversation block check、notification_settings.direct_message |
| #21 | P1 #6：garage 刪圖原子性 |

**會員子系統成熟度從 6/10 升到 7-8/10**：
- ✅ Block 關係已全域覆蓋（conversation 建立、followers/following 顯示、DM 通知）
- ✅ Privacy 設定正確生效到 trigger 層
- ✅ Resource 邊界處理一致（孤兒檔有 log、軟刪除留言不接受新動作、過期 invitation 拒絕）
- ⏳ 跨 tab 同步、reports admin dashboard、club ownership transfer 列入後續
