# 圖片存儲設置指南

## 前置步驟：創建 Supabase Storage Bucket

在部署代碼之前，您需要先在 Supabase Dashboard 中創建 storage bucket。

### 操作步驟

1. **登入 Supabase Dashboard**
   - 訪問 https://supabase.com/dashboard
   - 選擇您的項目 (car-news-ai)

2. **創建 Storage Bucket**
   - 左側選單點擊 **Storage**
   - 點擊右上角 **New bucket** 按鈕
   - 配置如下：

   ```
   Bucket name: article-images
   Public bucket: ✅ 啟用（允許公開訪問）
   File size limit: 50 MB
   Allowed MIME types: image/*
   ```

3. **設置訪問策略（RLS Policies）**

   Bucket 創建後，需要設置訪問策略。點擊 `article-images` bucket，然後點擊 **Policies** 標籤。

   添加以下策略：

   **Policy 1: 允許服務端上傳**
   ```sql
   CREATE POLICY "Service role can upload images"
   ON storage.objects FOR INSERT
   TO service_role
   WITH CHECK (bucket_id = 'article-images');
   ```

   **Policy 2: 允許公開讀取**
   ```sql
   CREATE POLICY "Public can read images"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'article-images');
   ```

4. **驗證設置**

   在 Storage 頁面，您應該看到 `article-images` bucket，狀態為 **Public**。

---

## 功能說明

### 圖片存儲服務 (`src/lib/storage/image-downloader.ts`)

**主要功能：**
- 從外部 URL 下載圖片
- 上傳到 Supabase Storage
- 返回 CDN 加速的公開 URL

**特性：**
- ✅ 自動生成唯一文件名（避免重複）
- ✅ 文件大小限制（10MB）
- ✅ 支持常見圖片格式（jpg, png, webp, gif）
- ✅ 30 秒下載超時保護
- ✅ 錯誤處理和降級方案
- ✅ CDN 快取優化（1年）

**文件組織結構：**
```
article-images/
├── {articleId}/
│   ├── {timestamp}-{hash}.jpg
│   ├── {timestamp}-{hash}.png
│   └── ...
```

---

## Generator 整合

### 修改內容

1. **引入圖片存儲服務**
   ```typescript
   import { downloadAndStoreImages } from '@/lib/storage/image-downloader'
   ```

2. **下載並存儲來源文章圖片**
   ```typescript
   // 原邏輯：直接使用外部 URL
   const images: Array<{ url: string; credit: string }> = []
   for (const article of cluster.articles) {
     if (article.image_url) {
       images.push({
         url: article.image_url,
         credit: article.image_credit || 'Unknown',
       })
     }
   }

   // 新邏輯：下載並存儲到 Supabase
   const storedImages = await downloadAndStoreImages(images, shortId)
   ```

3. **處理 AI 生成的封面圖**
   ```typescript
   // 如果有 AI 生成的封面圖，也下載並存儲
   if (generated.coverImage) {
     const storedCover = await downloadAndStoreImage(
       generated.coverImage,
       shortId,
       'AI Generated'
     )
     coverImage = storedCover?.url || generated.coverImage
   }
   ```

---

## 歷史數據回填

### 回填 API (`/api/admin/migrate-images`)

**功能：**
- 掃描所有文章的圖片 URL
- 下載外部圖片並存儲到 Supabase
- 更新資料庫記錄

**執行方式：**
```bash
curl -X POST https://wantcar.vercel.app/api/admin/migrate-images
```

**預期結果：**
- 處理 9 篇現有文章
- 下載並存儲約 10-20 張圖片
- 更新資料庫中的圖片 URL

---

## 監控和維護

### 存儲空間監控

在 Supabase Dashboard → Storage → article-images 可以查看：
- 總文件數量
- 佔用空間
- 最近上傳的文件

### 成本估算

**Supabase Storage 定價：**
- 存儲：$0.021/GB/月
- 傳輸：$0.09/GB（出站）

**預估：**
- 每張圖片平均 200KB
- 每月新增 100 篇文章 × 2 張圖片 = 200 張
- 月度存儲：200 × 0.2MB = 40MB ≈ $0.001
- 年度存儲：40MB × 12 = 480MB ≈ $0.01

**結論：成本幾乎可以忽略不計**

---

## 故障排除

### 上傳失敗

**錯誤：`Storage bucket not found`**
- 確認已創建 `article-images` bucket
- 檢查 bucket 名稱拼寫

**錯誤：`Permission denied`**
- 檢查 RLS policies 是否正確設置
- 確認使用 service_role 權限上傳

**錯誤：`File too large`**
- 圖片超過 10MB 限制
- 檢查來源圖片大小

### 圖片無法訪問

**問題：圖片 URL 返回 404**
- 確認 bucket 設為 Public
- 檢查文件是否成功上傳
- 驗證 publicUrl 格式正確

---

## 部署檢查清單

- [ ] Supabase bucket `article-images` 已創建
- [ ] Bucket 設為 Public
- [ ] RLS policies 已設置
- [ ] 本地測試通過
- [ ] Generator 整合完成
- [ ] 部署到生產環境
- [ ] 執行歷史數據回填
- [ ] 驗證新文章使用自建存儲
- [ ] 監控存儲空間使用情況
