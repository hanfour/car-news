# 🔄 自動刷新新文章功能

## 問題描述

用戶進入頁面後，即使有新文章發布，也**不會自動顯示**，必須手動刷新頁面才能看到。

### 原因分析

1. **Next.js 服務端渲染 (SSR)**
   - 頁面數據在服務端獲取
   - 有 ISR (Incremental Static Regeneration) 緩存
   - 原本設置 `revalidate = 60` 秒

2. **LoadingScreen 只是視覺效果**
   - 僅在首次載入時顯示動畫
   - 不代表數據正在刷新
   - 數據已經在服務端載入完成

3. **用戶體驗問題**
   - 用戶以為看到 loading 後會有新內容
   - 實際上看到的是緩存的舊數據
   - 必須手動刷新才能繞過緩存

---

## 解決方案

### 1. 降低 Revalidate 時間

```typescript
export const revalidate = 30 // 從 60 秒降至 30 秒
```

**效果**: 更快看到新文章，但仍有延遲

### 2. Realtime 新文章提醒（核心功能）

創建 `AutoRefreshArticles` 組件：

```typescript
// src/components/AutoRefreshArticles.tsx
'use client'

export function AutoRefreshArticles() {
  // 1. 使用 Supabase Realtime 監聽新文章
  // 2. 檢測到新文章時顯示提示按鈕
  // 3. 用戶點擊後觸發 router.refresh()
}
```

**特點:**
- ✅ 即時檢測新文章發布
- ✅ 友好的用戶提示
- ✅ 用戶主動刷新（不打斷閱讀）
- ✅ 使用 Supabase Realtime (無額外成本)

---

## 技術實現

### Supabase Realtime 訂閱

```typescript
const channel = supabase
  .channel('new-articles')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'generated_articles',
      filter: 'published=eq.true'
    },
    (payload) => {
      console.log('New article published:', payload.new)
      setHasNewArticles(true)
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'generated_articles',
      filter: 'published=eq.true'
    },
    (payload) => {
      // 檢測文章從草稿變為已發布
      if (payload.old?.published === false && payload.new?.published === true) {
        setHasNewArticles(true)
      }
    }
  )
  .subscribe()
```

### Next.js Router Refresh

```typescript
const handleRefresh = () => {
  setHasNewArticles(false)
  router.refresh() // 觸發服務端數據重新獲取
}
```

**關鍵**: `router.refresh()` 會：
1. 重新執行服務端組件的數據獲取
2. 繞過 ISR 緩存
3. 保持客戶端狀態
4. 不會完整重新加載頁面

---

## UI/UX 設計

### 提示按鈕

```tsx
<div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40">
  <button
    onClick={handleRefresh}
    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg"
  >
    <svg>...</svg>
    <span>有新文章！點擊查看</span>
  </button>
</div>
```

**設計考量:**
- 🎯 **固定在頂部中央** - 顯眼但不擋內容
- 🎨 **藍色主題** - 符合品牌色
- ✨ **動畫效果** - 滑入效果吸引注意
- 👆 **清晰的 CTA** - "點擊查看" 明確指示

### 動畫

```css
@keyframes slide-down {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
```

---

## 文件修改

### 1. 新增組件

**`src/components/AutoRefreshArticles.tsx`** (新增)
- Realtime 監聽邏輯
- 新文章提示 UI
- 刷新觸發機制

### 2. 更新首頁

**`src/app/page.tsx`** (修改)
```typescript
// 1. 導入組件
import { AutoRefreshArticles } from '@/components/AutoRefreshArticles'

// 2. 降低 revalidate
export const revalidate = 30 // 從 60 降至 30

// 3. 添加到頁面
<AutoRefreshArticles />
```

---

## 工作流程

### 用戶視角

1. 用戶進入首頁
2. Loading 動畫播放完成
3. 顯示當前文章列表
4. **10 秒後**，新文章發布
5. **即時**顯示提示按鈕: "有新文章！點擊查看"
6. 用戶點擊按鈕
7. 頁面刷新，顯示新文章
8. 提示消失

### 技術流程

```
1. 頁面載入
   ↓
2. 訂閱 Realtime channel
   ↓
3. 監聽 INSERT/UPDATE 事件
   ↓
4. 檢測到新文章
   ↓
5. setHasNewArticles(true)
   ↓
6. 顯示提示按鈕
   ↓
7. 用戶點擊
   ↓
8. router.refresh()
   ↓
9. 服務端重新獲取數據
   ↓
10. 客戶端更新 UI
```

---

## 優勢

### vs 完全客戶端渲染

| 方案 | SEO | 首屏速度 | 實時性 | 服務器負載 |
|------|-----|---------|--------|-----------|
| **SSR + Realtime** | ✅ 優秀 | ✅ 快 | ✅ 即時 | ✅ 低 |
| 完全 CSR | ❌ 差 | ❌ 慢 | ✅ 即時 | ✅ 低 |
| 純 SSR (60s revalidate) | ✅ 優秀 | ✅ 快 | ❌ 延遲 | ✅ 低 |

### vs 自動輪詢

| 方案 | 實時性 | 網絡開銷 | 服務器負載 |
|------|--------|---------|-----------|
| **Realtime** | ✅ 即時 | ✅ 低 | ✅ 低 |
| 每 10 秒輪詢 | ⚠️ 延遲 | ❌ 高 | ❌ 高 |

---

## Supabase Realtime 設定

### 確認已啟用

在 Supabase Dashboard:
1. 進入 **Database** → **Replication**
2. 確認 `generated_articles` 表已啟用 Realtime
3. 或執行 SQL:

```sql
ALTER PUBLICATION supabase_realtime
ADD TABLE generated_articles;
```

### 免費額度

- Realtime: **2 million messages/月** (免費)
- 當前使用: **極低** (只監聽新文章發布)
- 預估: < 1,000 messages/月

---

## 測試方法

### 1. 本地測試

```bash
# Terminal 1: 啟動開發服務器
npm run dev

# Terminal 2: 觸發文章生成
curl -X POST http://localhost:3000/api/cron/generator \
  -H "Authorization: Bearer $CRON_SECRET"
```

**預期**:
1. 開啟首頁 `http://localhost:3000`
2. 觸發生成器
3. 等待 30-60 秒
4. 看到提示按鈕出現
5. 點擊後看到新文章

### 2. 檢查 Realtime 連接

打開瀏覽器開發者工具 Console:
```
Supabase Realtime: Connected
New article published: { ... }
```

### 3. 手動插入測試

```sql
INSERT INTO generated_articles (
  id, title_zh, content_zh, published, published_at
) VALUES (
  'test123', '測試文章', '內容...', true, NOW()
);
```

**預期**: 立即看到提示按鈕

---

## 監控指標

### 1. Realtime 使用量

在 Supabase Dashboard → **Settings** → **Usage**:
- Realtime connections
- Realtime messages

### 2. 用戶行為

可以添加 Analytics 追蹤:
```typescript
const handleRefresh = () => {
  // 追蹤用戶點擊
  analytics.track('refresh_new_articles')
  router.refresh()
}
```

---

## 未來優化

### 1. 本地狀態持久化

```typescript
// 記住用戶已看過的文章
const [viewedArticles, setViewedArticles] = useState<Set<string>>(
  new Set(JSON.parse(localStorage.getItem('viewedArticles') || '[]'))
)
```

### 2. 文章數量提示

```tsx
<span>有 {newArticleCount} 篇新文章！點擊查看</span>
```

### 3. 自動刷新選項

```typescript
// 用戶可選擇自動刷新
if (userPreferences.autoRefresh) {
  router.refresh()
} else {
  setHasNewArticles(true)
}
```

---

## 總結

✅ **問題解決**: 用戶現在能即時看到新文章提示
✅ **用戶體驗**: 友好的提示，主動選擇刷新
✅ **技術方案**: SSR + Realtime 最佳實踐
✅ **成本**: 零額外成本（免費額度內）
✅ **性能**: 低網絡開銷，低服務器負載

**部署後效果**: 用戶不再需要手動刷新頁面來查看新文章！
