# OAuth 登入設定指南

## 問題診斷

如果第三方登入無法使用，請按照以下步驟檢查：

### 1. 檢查 Supabase OAuth 設定

前往 Supabase Dashboard：
https://supabase.com/dashboard/project/daubcanyykdfyptntfco/auth/providers

確認以下設定：

#### Google OAuth
- ✅ **已啟用** Google Provider
- ✅ **Authorized redirect URIs** 包含：
  ```
  https://daubcanyykdfyptntfco.supabase.co/auth/v1/callback
  https://wantcar.autos/auth/callback
  https://www.carnewsai.com/auth/callback
  ```

#### 必要欄位
- **Client ID**: `YOUR_GOOGLE_CLIENT_ID`
- **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`

### 2. Google Cloud Console 設定

前往：https://console.cloud.google.com/apis/credentials

#### OAuth 2.0 Client IDs 設定

**Authorized JavaScript origins:**
```
https://wantcar.autos
https://www.carnewsai.com
https://daubcanyykdfyptntfco.supabase.co
```

**Authorized redirect URIs:**
```
https://daubcanyykdfyptntfco.supabase.co/auth/v1/callback
https://wantcar.autos/auth/callback
https://www.carnewsai.com/auth/callback
```

### 3. 常見錯誤與解決方案

#### 錯誤 1: `redirect_uri_mismatch`
**原因**: Google Cloud Console 的 redirect URIs 設定不正確

**解決方案**:
1. 前往 Google Cloud Console
2. 編輯 OAuth 2.0 Client ID
3. 確認所有可能的 redirect URIs 都已新增

#### 錯誤 2: `access_denied`
**原因**: 用戶取消授權或 OAuth consent screen 設定問題

**解決方案**:
1. 檢查 OAuth consent screen 設定
2. 確認 app 狀態不是 "Testing" 或已新增測試用戶

#### 錯誤 3: `invalid_client`
**原因**: Client ID 或 Client Secret 錯誤

**解決方案**:
1. 在 Supabase Dashboard 重新檢查 Client ID 和 Secret
2. 確認沒有多餘的空白或換行

### 4. 測試步驟

1. **本地測試**:
   ```bash
   # 確認 callback route 可訪問
   curl http://localhost:3000/auth/callback
   ```

2. **生產環境測試**:
   - 點擊「使用 Google 登入」按鈕
   - 觀察瀏覽器是否重定向到 Google
   - 檢查開發者工具 Console 的錯誤訊息
   - 查看 Network tab 的請求詳情

3. **檢查 Supabase Logs**:
   ```
   Supabase Dashboard > Logs > Auth Logs
   ```

### 5. 當前程式碼改進

✅ **已改進的錯誤處理**:
- callback route 現在會捕捉並顯示詳細錯誤訊息
- LoginModal 會從 URL 參數讀取錯誤訊息
- Console 會記錄所有 OAuth 錯誤

✅ **改進的 redirect 處理**:
- 成功登入後重定向到 `/?auth=success`
- 失敗時重定向到 `/?error=xxx&message=xxx`

## 如何設定新的 OAuth Provider

### Facebook OAuth (未實作)

1. **前往 Facebook Developers**:
   https://developers.facebook.com/apps/

2. **建立應用程式**:
   - 選擇「消費者」類型
   - 新增「Facebook 登入」產品

3. **設定 OAuth redirect URIs**:
   ```
   https://daubcanyykdfyptntfco.supabase.co/auth/v1/callback
   ```

4. **在 Supabase 啟用 Facebook**:
   - 貼上 App ID 和 App Secret
   - 儲存設定

5. **修改 LoginModal.tsx**:
   ```tsx
   const handleFacebookLogin = async () => {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: 'facebook',
       options: {
         redirectTo: `${window.location.origin}/auth/callback`
       }
     })
   }
   ```

## 緊急修復

如果用戶無法登入，立即檢查：

1. ✅ Supabase Project 是否正常運行
2. ✅ OAuth Provider 是否啟用
3. ✅ Redirect URIs 是否正確
4. ✅ Client credentials 是否有效
5. ✅ 網域是否在允許清單中

## 支援

如果問題持續，請：
1. 檢查 Vercel Logs
2. 檢查 Supabase Auth Logs
3. 查看瀏覽器 Console 錯誤訊息
