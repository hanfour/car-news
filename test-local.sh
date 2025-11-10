#!/bin/bash

echo "🚀 Car News AI - 本地测试脚本"
echo "================================"
echo ""

# 清理旧进程
echo "1️⃣ 清理旧的Next.js进程..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

# 启动开发服务器
echo "2️⃣ 启动开发服务器..."
npm run dev > /tmp/car-news-dev.log 2>&1 &
DEV_PID=$!
echo "   PID: $DEV_PID"

# 等待服务器就绪
echo "3️⃣ 等待服务器启动..."
sleep 10

# 检查服务器状态
if ps -p $DEV_PID > /dev/null; then
    echo "   ✅ 服务器运行中"
else
    echo "   ❌ 服务器启动失败"
    cat /tmp/car-news-dev.log
    exit 1
fi

# 测试scraper API
echo ""
echo "4️⃣ 测试Scraper API（抓取新闻）..."
echo "   这可能需要30-60秒..."
RESPONSE=$(curl -s -X GET http://localhost:3000/api/cron/scraper \
  -H "Authorization: Bearer YPxXuvXTQ1+Ya0Vb7tA+PV8W2SQCbbAvU4r46z5jKvE=")

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))" 2>/dev/null || echo "$RESPONSE"

# 清理
echo ""
echo "5️⃣ 清理..."
kill $DEV_PID 2>/dev/null || true
sleep 2

echo ""
echo "✅ 测试完成！"
echo ""
echo "📝 如果看到抓取的文章，说明一切正常。"
echo "📝 接下来可以访问 http://localhost:3000 查看网站。"
