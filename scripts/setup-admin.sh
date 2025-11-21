#!/bin/bash

echo "🔐 Admin 管理後台設置助手"
echo "================================"
echo ""

# 檢查是否有 .env.local
if [ ! -f .env.local ]; then
  echo "❌ 找不到 .env.local 文件"
  echo "請先創建 .env.local 並設置環境變量"
  exit 1
fi

# 顯示需要執行的 SQL
echo "📝 步驟 1: 應用數據庫遷移"
echo "--------------------------------"
echo "請打開 Supabase Dashboard → SQL Editor，執行以下 SQL:"
echo ""
cat supabase/migrations/20251119_add_admin_users.sql
echo ""
echo "按 Enter 繼續..."
read

echo ""
echo "📝 步驟 2: 設置第一個 Admin 用戶"
echo "--------------------------------"
echo "請輸入您要設為 Admin 的 Email 地址:"
read -p "Email: " admin_email

if [ -z "$admin_email" ]; then
  echo "❌ Email 不能為空"
  exit 1
fi

echo ""
echo "在 Supabase Dashboard → SQL Editor 執行以下 SQL:"
echo ""
echo "UPDATE profiles SET is_admin = TRUE WHERE email = '$admin_email';"
echo ""
echo "按 Enter 繼續..."
read

echo ""
echo "📝 步驟 3: 測試登入"
echo "--------------------------------"
echo "1. 啟動開發服務器: npm run dev"
echo "2. 訪問: http://localhost:3000/admin/login"
echo "3. 使用您的 Email ($admin_email) 和密碼登入"
echo ""
echo "✅ 設置完成！完整文檔請參考: docs/admin-setup.md"
