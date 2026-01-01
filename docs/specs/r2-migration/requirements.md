# Cloudflare R2 存储迁移 - Requirements Document

将图片存储从 Supabase Storage 迁移到 Cloudflare R2，降低带宽成本并为未来的行车记录视频存储做准备。参考 miilink 项目的 R2 实现。

## Core Features

### 1. R2 存储客户端

基于 miilink 项目的实现（`/lib/r2/client.ts`），创建 R2 存储客户端：

| 功能 | 说明 |
|------|------|
| `uploadFile` | 服务端直接上传文件到 R2 |
| `deleteFile` | 删除 R2 中的文件 |
| `getCDNUrl` | 获取 CDN 公开访问 URL |
| `generateUploadUrl` | 生成 presigned URL（未来用于用户直传） |

### 2. 图片上传器适配

修改现有的 `image-uploader.ts`，支持双存储后端：

```typescript
type StorageBackend = 'supabase' | 'r2'

// 环境变量控制使用哪个后端
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'supabase'
```

### 3. 渐进式迁移策略

| 阶段 | 策略 | 影响 |
|------|------|------|
| Phase 1 | 新图片写入 R2，旧图片保持 Supabase | 零停机 |
| Phase 2 | 批量迁移旧图片到 R2 | 后台执行 |
| Phase 3 | 切换默认后端为 R2 | 配置变更 |
| Phase 4 | 清理 Supabase Storage | 降成本 |

### 4. CDN 配置

- 使用 Cloudflare R2 自带的 `r2.dev` 域名
- 或绑定自定义域名（如 `images.carnews.ai`）
- 配置缓存策略（图片永久缓存）

### 5. 未来扩展：视频存储

为行车记录功能预留视频存储能力：

| 类型 | 大小限制 | 存储路径 |
|------|----------|----------|
| 文章图片 | 10MB | `articles/{date}/{id}.webp` |
| 用户头像 | 2MB | `avatars/{user_id}.webp` |
| 行车记录 | 500MB | `dashcam/{date}/{incident_id}/{file}.mp4` |

## User Stories

### 运维人员
- As a **运维人员**, I want **通过环境变量切换存储后端**, so that **可以灵活控制迁移节奏**
- As a **运维人员**, I want **批量迁移脚本**, so that **可以在非高峰期迁移旧图片**

### 开发人员
- As a **开发人员**, I want **统一的存储 API**, so that **不需要关心底层是 Supabase 还是 R2**
- As a **开发人员**, I want **本地开发可以 fallback 到 Supabase**, so that **不需要配置 R2 也能开发**

### 终端用户
- As a **用户**, I want **图片加载速度不受影响**, so that **阅读体验不变**

## Acceptance Criteria

### P0 - 核心功能
- [ ] R2 客户端模块（参考 miilink `/lib/r2/client.ts`）
- [ ] 环境变量配置（R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL）
- [ ] 修改 `image-uploader.ts` 支持 R2 后端
- [ ] 新上传的图片存储到 R2
- [ ] CDN URL 正确生成

### P1 - 迁移工具
- [ ] 批量迁移脚本：从 Supabase 读取图片并上传到 R2
- [ ] 数据库更新脚本：更新 `generated_articles` 表中的图片 URL
- [ ] 迁移进度追踪和断点续传

### P2 - 清理和优化
- [ ] Supabase Storage 清理脚本
- [ ] 图片 URL 验证脚本（确保迁移后可访问）
- [ ] 监控和告警（R2 存储用量、请求量）

## Non-functional Requirements

### 性能要求
- 图片上传延迟 < 2秒（与 Supabase 相当）
- CDN 响应时间 < 100ms（Cloudflare 全球节点）
- 迁移脚本支持并发，提高迁移速度

### 安全要求
- R2 API 密钥安全存储（环境变量）
- 公开访问仅限 CDN URL
- 禁止直接访问 S3 API 端点

### 兼容要求
- 与现有文章系统完全兼容
- 旧的 Supabase URL 继续可用（迁移期间）
- 本地开发可选择使用 Supabase（无需 R2 配置）

### 成本控制
- 利用 R2 免费出口流量
- 设置存储配额告警
- 定期清理未使用的图片

## 环境变量配置

```bash
# Cloudflare R2 配置
R2_ENDPOINT="https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
R2_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
R2_BUCKET_NAME="car-news-images"
R2_PUBLIC_URL="https://images.carnews.ai"  # 或使用 r2.dev 域名

# 存储后端选择
STORAGE_BACKEND="r2"  # 'supabase' | 'r2'
```

## 参考实现

miilink 项目的 R2 实现：
- `/Users/hanfourhuang/Projects/miilink/lib/r2/client.ts` - R2 客户端
- `/Users/hanfourhuang/Projects/miilink/.env.example` - 环境变量配置
