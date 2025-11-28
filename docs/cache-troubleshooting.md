# 🔍 緩存問題排查指南

## 問題現象

用戶反應「看不到新文章的圖片」，但數據庫檢查顯示**所有文章都有圖片**。

## 根本原因

**多層緩存機制導致的延遲：**

1. **Next.js ISR 緩存** (服務端)
   - 設定: `revalidate = 10` 秒
   - 影響: 10 秒內的請求都返回緩存頁面

2. **瀏覽器緩存** (客戶端)
   - 影響: 即使服務端更新，瀏覽器仍使用本地緩存

3. **CDN 緩存** (如果有使用)
   - 影響: 邊緣節點緩存頁面

---

## 快速解決方案

### 用戶端（最常見）

**方法 1: 強制刷新瀏覽器**
- Windows/Linux: `Ctrl + Shift + R` 或 `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**方法 2: 清除瀏覽器緩存**
1. 打開瀏覽器設置
2. 清除緩存和 Cookie
3. 重新載入頁面

**方法 3: 使用無痕模式**
- 打開新的無痕/隱私視窗
- 訪問網站
- 應該能看到最新內容

---

### 開發端

**方法 1: 重啟開發服務器**
```bash
# 刪除 Next.js 緩存
rm -rf .next

# 重啟服務器
npm run dev
```

**方法 2: 降低 revalidate 時間**
```typescript
// src/app/page.tsx
export const revalidate = 10 // 開發環境使用 10 秒
```

**方法 3: 使用 router.refresh()**
- 點擊頁面上的「有新文章！點擊查看」按鈕
- 這會觸發 Next.js 重新獲取服務端數據

---

## 診斷工具

### 1. 檢查數據庫狀態

```bash
npx tsx scripts/check-recent-articles.ts
```

**輸出示例:**
```
✅ 所有已發布的文章都有封面圖！
```

### 2. 檢查圖片可訪問性

```bash
curl -I https://daubcanyykdfyptntfco.supabase.co/storage/v1/object/public/article-images/XXX.jpg
```

應該返回 `HTTP/2 200`

### 3. 檢查頁面緩存標頭

在瀏覽器開發者工具 → Network:
- 查看 Response Headers
- 檢查 `Cache-Control`, `Age`, `X-Vercel-Cache`

---

## 技術細節

### Next.js ISR 工作原理

```
用戶請求頁面
    ↓
檢查緩存
    ↓ 如果在 revalidate 時間內
返回緩存頁面 (快速)
    ↓ 如果超過 revalidate 時間
後台重新生成頁面
    ↓
下次請求返回新頁面
```

**關鍵點**: 
- 第一個超時的請求仍返回舊頁面
- 新頁面在**後台**生成
- **下一個**請求才能看到新內容

### Revalidate 時間選擇

| 時間 | 優點 | 缺點 | 適用場景 |
|------|------|------|---------|
| 10 秒 | 內容更新快 | 服務器負載高 | 開發環境 |
| 30 秒 | 平衡 | 30 秒延遲 | 一般生產環境 |
| 60 秒 | 服務器負載低 | 更新較慢 | 低頻更新網站 |
| 0 秒 | 即時更新 | 負載極高 | SSR (不推薦) |

---

## 生產環境建議

### 1. 合理的 Revalidate 設定

```typescript
export const revalidate = 30 // 生產環境: 30 秒
```

### 2. 使用 On-Demand Revalidation

當新文章發布時，主動觸發重新驗證：

```typescript
// 在文章生成後
await fetch('https://yourdomain.com/api/revalidate', {
  method: 'POST',
  headers: { 'x-revalidate-secret': process.env.REVALIDATE_SECRET },
  body: JSON.stringify({ path: '/' })
})
```

### 3. 實時更新提示（已實現）

使用 Supabase Realtime 監聽新文章，提示用戶刷新：

```typescript
<AutoRefreshArticles />
```

---

## 常見問題 Q&A

### Q1: 為什麼刷新頁面還是看不到新內容？

**A**: 可能是瀏覽器緩存。使用 **Ctrl + Shift + R** (Windows) 或 **Cmd + Shift + R** (Mac) 強制刷新。

### Q2: 開發環境修改代碼後沒有效果？

**A**: 刪除 `.next` 目錄並重啟：
```bash
rm -rf .next && npm run dev
```

### Q3: 為什麼有時能看到新文章，有時看不到？

**A**: 這是 ISR 的特性。在 revalidate 時間窗口內，不同用戶可能看到不同版本的頁面。

### Q4: 如何確認看到的是最新數據？

**A**: 
1. 查看頁面底部的時間戳
2. 檢查文章發布時間
3. 使用無痕模式訪問

### Q5: 生產環境應該設定多少 revalidate？

**A**: 
- 新聞網站: 30-60 秒
- 一般網站: 60-300 秒
- 靜態內容: 3600 秒 (1 小時)

---

## 檢查清單

當用戶報告「看不到新內容」時：

- [ ] 1. 運行診斷腳本確認數據庫有數據
  ```bash
  npx tsx scripts/check-recent-articles.ts
  ```

- [ ] 2. 要求用戶強制刷新瀏覽器
  - Windows: `Ctrl + Shift + R`
  - Mac: `Cmd + Shift + R`

- [ ] 3. 檢查是否在 revalidate 時間窗口內
  - 等待 10-30 秒後重試

- [ ] 4. 檢查 AutoRefreshArticles 是否正常工作
  - 應該顯示「有新文章」提示

- [ ] 5. 如果是開發環境，重啟服務器
  ```bash
  rm -rf .next && npm run dev
  ```

- [ ] 6. 檢查圖片 URL 是否可訪問
  ```bash
  curl -I <image-url>
  ```

- [ ] 7. 檢查瀏覽器控制台是否有錯誤

---

## 總結

**新文章有圖片但看不到** 99% 是**緩存問題**，不是數據問題。

**最快解決方法**: **強制刷新瀏覽器** (Ctrl/Cmd + Shift + R)

**長期方案**: 
1. ✅ 降低 revalidate 時間 (10-30 秒)
2. ✅ 實現 AutoRefreshArticles 組件
3. ⏳ 添加 On-Demand Revalidation (未來)
