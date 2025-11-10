import crypto from 'crypto'

export function generateTopicHash(centroid: number[]): string {
  const data = centroid.join(',')
  return crypto.createHash('sha256').update(data).digest('hex')
}
