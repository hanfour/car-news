# 🚨 域名更新通知

## 問題發現

**日期**: 2025-11-17
**發現者**: Claude Code Audit

### 當前狀況

- ❌ **舊域名**: `wantcar.com` - **無法訪問** (連線逾時)
- ✅ **新域名**: `wantcar.autos` - **正常運作**

### 影響範圍

1. **OAuth 認證流程**
   - Redirect URLs 指向錯誤域名
   - 登入失敗

2. **SEO 和元數據**
   - Canonical URLs 錯誤
   - Open Graph URLs 錯誤

3. **Cron 任務**
   - 可能使用錯誤的 base URL

4. **文章更新停滯**
   - 已兩天未更新文章
   - 可能與域名配置有關

---

## ✅ 必要行動清單

### 1. Vercel 環境變數更新

前往 Vercel Dashboard → Project Settings → Environment Variables

更新以下變數 (Production, Preview, Development 全選):

```
NEXT_PUBLIC_BASE_URL=https://wantcar.autos
NEXT_PUBLIC_SITE_URL=https://wantcar.autos
```

### 2. Supabase 認證設定更新

前往 Supabase Dashboard → Authentication → URL Configuration:

**Site URL**:
```
https://wantcar.autos
```

**Redirect URLs** (添加):
```
https://wantcar.autos/**
https://wantcar.autos/auth/callback
https://wantcar.autos/auth-callback.html
```

**移除舊 URL**:
```
https://wantcar.com/** (移除)
```

### 3. Google OAuth Console 更新

前往 Google Cloud Console → APIs & Credentials

確認 Authorized redirect URIs 包含:
```
https://daubcanyykdfyptntfco.supabase.co/auth/v1/callback
```

不應包含:
```
https://wantcar.com/* (移除)
```

### 4. 本地開發環境更新

已更新 `.env.local`:
```bash
NEXT_PUBLIC_BASE_URL=https://wantcar.autos
NEXT_PUBLIC_SITE_URL=https://wantcar.autos
```

### 5. 檢查 Cron 任務

更新後檢查:
- `/api/cron/scraper` - 每 2 小時執行
- `/api/cron/generator` - 每 6 小時執行
- `/api/cron/cleanup` - 每天執行

---

## 📊 驗證清單

完成上述更新後，驗證以下功能:

- [ ] OAuth 登入流程正常
- [ ] 首頁顯示最新文章
- [ ] Cron 任務正常執行
- [ ] SEO meta tags 包含正確域名
- [ ] Sitemap 使用正確域名

---

## 🔍 診斷資訊

### Vercel 部署資訊
```
Latest Deployment: car-news-6rbabp8px-hanfours-projects.vercel.app
Status: ● Ready
Aliases:
  - https://wantcar.autos ✅
  - https://www.wantcar.autos ✅
  - https://wantcar.vercel.app
```

### 網站狀態
```bash
# 新域名 - 正常
curl -I https://wantcar.autos
# HTTP/2 200 ✅

# 舊域名 - 無法訪問
curl -I https://wantcar.com
# Connection timeout ❌
```

---

## 📝 後續建議

1. **監控 Cron 任務**
   - 檢查是否恢復文章更新
   - 確認無錯誤日誌

2. **DNS 配置檢查**
   - 確認 `wantcar.com` 是否需要重定向到 `wantcar.autos`
   - 或是完全棄用舊域名

3. **通知用戶**
   - 如果有既有用戶，通知域名更改
   - 更新所有外部連結

---

**最後更新**: 2025-11-17 09:22 (UTC+8)
