import crypto from 'crypto'

export function generateTopicHash(centroid: number[] | string): string {
  // Handle both string and array formats
  let parsedCentroid: number[]

  if (typeof centroid === 'string') {
    parsedCentroid = JSON.parse(centroid)
  } else {
    parsedCentroid = centroid
  }

  const data = parsedCentroid.join(',')
  return crypto.createHash('sha256').update(data).digest('hex')
}
