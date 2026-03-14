/**
 * Cloudflare R2 Storage 客戶端（S3 相容 API）
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'car-news-images'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-212c7eaf59fa41c69e2d4959e72c4a29.r2.dev'

let client: S3Client | null = null

export function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return client
}

/**
 * 上傳檔案到 R2
 * @returns public URL
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string
): Promise<string> {
  const s3 = getR2Client()

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body instanceof Blob ? Buffer.from(await body.arrayBuffer()) : body,
    ContentType: contentType,
  }))

  return `${R2_PUBLIC_URL}/${key}`
}

/**
 * 從 R2 刪除檔案
 */
export async function deleteFromR2(key: string): Promise<void> {
  const s3 = getR2Client()

  await s3.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }))
}

/**
 * 列出 R2 中指定前綴的物件
 */
export async function listR2Objects(prefix?: string): Promise<Array<{ key: string; lastModified?: Date; size?: number }>> {
  const s3 = getR2Client()

  const response = await s3.send(new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
  }))

  return (response.Contents || []).map(obj => ({
    key: obj.Key!,
    lastModified: obj.LastModified,
    size: obj.Size,
  }))
}
