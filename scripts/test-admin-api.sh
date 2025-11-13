#!/bin/bash

# Admin API 測試腳本
# 使用方法: ./scripts/test-admin-api.sh

# 設定
API_KEY="Cjz5hMqUj0PeTyVP8jammO0lPRb8C7qv4="
BASE_URL="http://localhost:3000"

echo "=========================================="
echo "Admin API 測試"
echo "=========================================="
echo ""

# Test 1: 列出文章
echo "1. 列出前 3 篇已發布文章"
echo "------------------------------------------"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=3" \
  | jq '.articles[] | {id, title_zh, confidence, view_count}'
echo ""

# Test 2: 查找低 confidence 文章
echo "2. 查找低質量文章 (confidence < 70)"
echo "------------------------------------------"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=100" \
  | jq '.articles[] | select(.confidence < 70) | {id, title_zh, confidence}'
echo ""

# Test 3: 獲取文章 ID (用於後續測試)
ARTICLE_ID=$(curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=1" \
  | jq -r '.articles[0].id')

echo "3. 測試文章 ID: $ARTICLE_ID"
echo ""

# Test 4: 給文章評分
echo "4. 給文章評 5 分 (優秀)"
echo "------------------------------------------"
curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "$BASE_URL/api/admin/articles/$ARTICLE_ID" \
  | jq '{id, title_zh, human_rating}'
echo ""

# Test 5: 查看統計
echo "5. 統計資訊"
echo "------------------------------------------"
echo "總文章數:"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?limit=1" \
  | jq '.total'

echo "已發布:"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=1" \
  | jq '.total'

echo "草稿:"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=false&limit=1" \
  | jq '.total'

echo ""
echo "=========================================="
echo "測試完成!"
echo "=========================================="
echo ""
echo "💡 提示: 查看 /docs/admin-api-usage.md 了解更多用法"
