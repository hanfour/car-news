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

---

## 真實 bug 清單（按優先度）

### 🔴 P0 — 本 PR 修復

| # | 位置 | 症狀 | 修法 |
|---|---|---|---|
| 1 | `src/app/api/user/[username]/block/route.ts:14` | `resolveTargetId` 在 profile 不存在時 `targetId = profile?.id ‖ username`，把 username 字串當 UUID 寫入 `user_blocks.blocked_id` 觸發 cast error 回 500 | 改用 `maybeSingle` + 明確 null 檢查，找不到回 404 |
| 2 | `src/app/api/user/avatar/route.ts:33` | 從 `file.name.split('.').pop()` 取副檔名，攻擊者可上傳 `.svg` 偽裝成 JPG MIME 通過驗證但檔名是 `.svg` | 改用 MIME→ext 對應表，不信任 filename |
| 3 | `src/app/api/user/profile/route.ts:31` | username 無保留字檢查，使用者可註冊 `admin` / `api` / `settings` 等與路由衝突的名稱 | 加保留字 set + 檢查；同時改 `eq` 為 `ilike` 做大小寫不敏感的唯一性檢查 |

### 🟠 P1 — 後續 follow-up（價值高但 scope 較大）

| # | 位置 | 症狀 | 建議 |
|---|---|---|---|
| 4 | `find_or_create_conversation` RPC | 被封鎖者仍能與封鎖者建立對話 | RPC 內補 `EXISTS user_blocks` 檢查 |
| 5 | DM trigger `on_new_message` | 不讀 `notification_settings`，使用者已停用 DM 通知仍寫入 | trigger 內 join `notification_settings` |
| 6 | `garage/[id]/images/route.ts:168` | R2 刪除成功但 DB 失敗時產生孤兒檔，無 transaction | 加 cleanup job 或反向 retry |
| 7 | `comments/[id]/like/route.ts:56-96` | 點讚計數讀寫分離有 race | 改用 trigger 自動更新 |
| 8 | `articles/[id]/share/route.ts:32` | 無 rate limit 與去重，share 計數可被機器人灌水 | 加 IP/session 去重 + rate limit |
| 9 | `forum/posts/route.ts:38` | search 用 replace 移除標點，遇中文/特殊字仍可能誤解析 | 改用 PostgreSQL full-text search 或 `.textSearch()` |
| 10 | `clubs/[slug]/leave/route.ts` | owner 無法轉讓社團，帳號閒置整個 club 變孤兒 | 加 transfer_ownership 端點 |
| 11 | `club_invitations` | migration 有 `expires_at` 但 API 接受邀請時未驗證 | invitation accept 前檢查過期 |
| 12 | `comments/[id]/report/route.ts:27` | 報告前未檢查留言已軟刪除 | 報告前先確認 `is_deleted=false` |
| 13 | followers/following 路由 | 列表沒過濾 block 關係（被封鎖的 user 仍出現在 follower 名單） | 加 join `user_blocks` 過濾 |

### 🟡 P2 — 非阻擋性、可長期改進

- 跨 tab 登出同步（BroadcastChannel）
- 跨 tab 未讀計數同步（取代多 tab polling）
- Mark all read 失敗時 pessimistic 降級（refresh 真實狀態）
- Reports 審核流程 + admin dashboard
- Avatar 舊檔清理（每次上傳會 upsert，但若改副檔名會留舊檔）
- Garage soft delete（目前 hard delete）
- Username uniqueness DB-level constraint（已有 unique index？需確認）

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
