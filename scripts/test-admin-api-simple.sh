#!/bin/bash

# Admin API 簡易測試腳本
API_KEY="Cjz5hMqUj0PeTyVP8jammO0lPRYMMUfB+5UBs8C7qv4="
BASE_URL="http://localhost:3000"

echo "=========================================="
echo "Admin API 測試"
echo "=========================================="
echo ""

# Test 1: 列出文章
echo "📋 Test 1: 列出前 5 篇已發布文章"
echo "------------------------------------------"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=5" \
  | python3 -m json.tool

echo ""
read -p "按 Enter 繼續下一個測試..."
echo ""

# Test 2: 查看統計
echo "📊 Test 2: 統計資訊"
echo "------------------------------------------"
echo -n "總文章數: "
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?limit=1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])"

echo -n "已發布: "
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])"

echo -n "草稿: "
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=false&limit=1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])"

echo ""
read -p "按 Enter 繼續下一個測試..."
echo ""

# Test 3: 獲取第一篇文章 ID
echo "🔍 Test 3: 獲取測試文章 ID"
echo "------------------------------------------"
ARTICLE_ID=$(curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['articles'][0]['id'])")

echo "測試文章 ID: $ARTICLE_ID"
echo ""

# Test 4: 給文章評分
read -p "是否要給這篇文章評 5 分？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "⭐ Test 4: 給文章評 5 分"
    echo "------------------------------------------"
    curl -s -X PATCH \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"human_rating": 5}' \
      "$BASE_URL/api/admin/articles/$ARTICLE_ID" \
      | python3 -m json.tool
    echo ""
    echo "✅ 評分完成！"
else
    echo "跳過評分測試"
fi

echo ""
echo "=========================================="
echo "測試完成！"
echo "=========================================="
echo ""
echo "💡 更多測試範例請參考: ADMIN_API_QUICK_START.md"
