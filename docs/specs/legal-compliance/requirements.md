# 法律合规升级计划 - Requirements Document

将网站从「内容改写者」转变为「资讯加工者」，确保完全合法且永续经营。包括：图片来源改革、内容生成去抄袭化、法律声明页面、来源导流优化、原创加值功能。

**优先级：P-1（高于所有功能开发）**

---

## Core Features

### 阶段一：图片来源改革（最危险区，必须立即处理）

#### 1.1 停止下载他站图片

**当前问题：**
```typescript
// image-downloader.ts - 直接下载他站图片
const response = await fetch(imageUrl, {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)' },
})
```

**改革方案：**

| 图片来源 | 处理方式 | 优先级 |
|----------|----------|--------|
| 官方新闻图片 (Press Images) | 下载并标注来源 | ✅ 合法 |
| 社群媒体 (IG/YT/Twitter) | 使用嵌入代码 (Embed) | ✅ 合法 |
| AI 生成图片 | 使用 DALL-E / Imagen 生成 | ✅ 合法 |
| 其他私人网站/部落格 | 🚫 禁止使用 | ❌ 删除 |

#### 1.2 官方新闻图片来源

建立品牌官方媒体资源库：

| 品牌 | Newsroom URL |
|------|--------------|
| Toyota | https://newsroom.toyota.com |
| Tesla | https://www.tesla.com/press |
| BMW | https://www.press.bmw.com |
| Mercedes | https://media.mercedes-benz.com |
| Honda | https://global.honda/newsroom |
| Ford | https://media.ford.com |
| Hyundai | https://www.hyundai.news |

#### 1.3 AI 生成封面图

当无官方图片时，使用 AI 生成示意图：

```typescript
// 生成 prompt 范例
const prompt = `
汽车新闻封面图：${article.title}
风格：现代、简洁、专业
元素：${article.brands.join(', ')} 品牌相关
标注：右下角加「AI 生成示意图」浮水印
`
```

### 阶段二：内容生成去抄袭化

#### 2.1 Prompt 优化

**当前问题：**
```
請按照上述風格指南，撰寫一篇綜合報導。
```
这可能导致 AI 只是「换句话说」。

**改革方案：**

```markdown
## 任务说明

你是一位「数据分析师」，而非「文章改写者」。

请根据以下 ${sources.length} 篇来源文章，执行以下步骤：

### 步骤一：数据提取
从来源中提取以下客观数据（数据本身不受著作权保护）：
- 价格：具体数字、涨跌幅度
- 规格：马力、扭力、电池容量、续航里程
- 日期：发布日期、上市时间、生效日期
- 地区：适用市场、销售区域

### 步骤二：以「中立分析师」口吻撰写
- 禁止使用与来源相同的形容词和句式
- 自行重新构思文章结构
- 使用表格呈现规格对比
- 加入「这对消费者意味着什么」的分析

### 步骤三：来源标注
- 文章开头即标注来源
- 提供原文链接供深度阅读

### 禁止事项
- ❌ 不得复制来源的描述性文字
- ❌ 不得使用与来源相似度 > 30% 的句子
- ❌ 不得保留来源的文章结构
```

#### 2.2 相似度检测

在文章生成后，使用工具检测与来源的相似度：

```typescript
interface SimilarityCheck {
  sourceUrl: string
  similarity: number  // 0-100%
  matchedPhrases: string[]
}

// 如果相似度 > 30%，拒绝发布
if (similarity > 30) {
  throw new Error('相似度过高，需要重新生成')
}
```

### 阶段三：法律声明页面

#### 3.1 版权声明页 `/copyright`

```markdown
# 版权声明

## 关于本站
CarNews.ai 是一个 AI 驱动的汽车资讯聚合工具。我们的目标是帮助读者
快速了解汽车产业动态，而非取代原创媒体。

## 内容来源
本站内容基于公开数据和官方新闻资料撰写：
- 所有数据来自品牌官方发布
- 所有来源均已标注并提供原文链接
- 我们鼓励读者点击原文链接获取深度内容

## 图片来源
- 官方新闻图片：来自各品牌 Newsroom，已标注来源
- AI 生成图片：标注「AI 生成示意图」浮水印

## 联系我们
如有任何版权疑虑，请联系：copyright@carnews.ai
```

#### 3.2 DMCA 下架机制 `/dmca`

```markdown
# 版权问题处理

## 我们的承诺
如果您认为本站内容侵犯了您的版权，我们将于 24 小时内处理。

## 举报方式
请发送邮件至 dmca@carnews.ai，包含以下信息：
1. 您的姓名和联系方式
2. 涉嫌侵权的内容 URL
3. 您拥有版权的证明
4. 您的电子签名

## 处理流程
1. 收到举报后 24 小时内确认
2. 48 小时内完成审核
3. 确认侵权后立即下架
```

#### 3.3 页尾添加链接

```html
<footer>
  <a href="/copyright">版权声明</a> |
  <a href="/dmca">版权问题处理</a> |
  <a href="mailto:contact@carnews.ai">联系我们</a>
</footer>
```

### 阶段四：来源导流优化

#### 4.1 高亮度来源按钮

在文章**开头**添加来源标注（而非文末）：

```tsx
<SourceBanner>
  📣 本文资讯汇整自：
  <SourceLink href={source1.url}>{source1.name}</SourceLink>
  <SourceLink href={source2.url}>{source2.name}</SourceLink>
  → 点此阅读深度评测
</SourceBanner>
```

#### 4.2 来源 nofollow 属性

虽然我们导流给来源，但不传递 SEO 权重：

```html
<a href="..." rel="nofollow" target="_blank">来源网站</a>
```

### 阶段五：原创加值功能

#### 5.1 自动化计算机

```typescript
// 根据车价自动计算台湾税费
interface TaxCalculation {
  vehiclePrice: number
  licenseTax: number      // 牌照税
  fuelTax: number         // 燃料税
  importDuty?: number     // 进口关税
  commodityTax?: number   // 货物税
  totalCost: number
}
```

#### 5.2 规格对比表

```tsx
<ComparisonTable>
  <thead>
    <tr>
      <th>规格</th>
      <th>Model 3</th>
      <th>Model Y</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>马力</td><td>283 hp</td><td>299 hp</td></tr>
    <tr><td>续航</td><td>491 km</td><td>455 km</td></tr>
    <tr><td>价格</td><td>$169.99 万</td><td>$179.99 万</td></tr>
  </tbody>
</ComparisonTable>
```

#### 5.3 二手行情预测（未来）

```typescript
interface ResaleValuePrediction {
  model: string
  year: number
  currentPrice: number
  predictedValueAfter3Years: number
  depreciationRate: number
  marketPopularity: 'high' | 'medium' | 'low'
}
```

---

## User Stories

### 网站运营者
- As a **网站运营者**, I want **确保所有图片来源合法**, so that **不会收到版权诉讼**
- As a **网站运营者**, I want **内容与来源相似度低于 30%**, so that **不会被指控抄袭**
- As a **网站运营者**, I want **有明确的 DMCA 机制**, so that **展现善意管理员形象**

### 终端用户
- As a **用户**, I want **快速了解新闻核心数据**, so that **不需要阅读冗长文章**
- As a **用户**, I want **看到规格对比表**, so that **容易比较不同车款**
- As a **用户**, I want **一键跳转原文**, so that **获取更深入的报导**

### 原创媒体
- As a **来源媒体**, I want **我的文章被标注来源**, so that **获得应有的曝光**
- As a **来源媒体**, I want **有下架机制**, so that **我的权益受到保护**

---

## Acceptance Criteria

### P-1 - 立即执行（本周）
- [ ] 停止 `image-downloader.ts` 下载非官方图片
- [ ] 清理现有数据库中的侵权图片
- [ ] 建立品牌官方 Newsroom 图片来源列表
- [ ] 添加 `/copyright` 版权声明页面
- [ ] 添加 `/dmca` 下架机制页面
- [ ] 页尾添加版权相关链接

### P0 - 一周内
- [ ] 修改 Prompt 为「数据提取 + 分析师口吻」模式
- [ ] 添加相似度检测，拒绝 > 30% 的文章
- [ ] 文章开头添加高亮度来源按钮
- [ ] AI 生成封面图（无官方图片时）

### P1 - 两周内
- [ ] 自动化税费计算器
- [ ] 规格对比表组件
- [ ] 社群媒体嵌入（IG/YT/Twitter）

### P2 - 一月内
- [ ] 二手行情预测
- [ ] PTT/Mobile01 讨论摘要

---

## Non-functional Requirements

### 法律合规
- 与来源文章相似度必须 < 30%
- 所有图片必须有合法来源
- DMCA 请求必须在 24 小时内响应

### 用户体验
- 来源标注不影响阅读体验
- 法律声明页面简洁易懂

### 可审计性
- 记录每篇文章的来源和生成时间
- 记录每张图片的来源 URL
- 记录相似度检测结果

---

## 合规操作核对表

```
[ ] 图片：我是否已经停止下载他人网站的图片？
[ ] 内容：Gemini 产出的文字与原文相似度是否低于 30%？
[ ] 导流：我是否提供了明显的「原文链接」回馈给对方网站？
[ ] 通知：我的网站是否有联络 Email 可以让作者要求下架？
[ ] 数据：我是否加入了表格、计算、对比等「再处理」流程？
```
