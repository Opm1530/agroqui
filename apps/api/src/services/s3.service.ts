import AWS from 'aws-sdk'
import { env } from '../config/env'

function isS3Configured(): boolean {
  return !!(
    env.AWS_ACCESS_KEY_ID &&
    env.AWS_SECRET_ACCESS_KEY &&
    env.AWS_S3_BUCKET &&
    env.AWS_REGION
  )
}

function getS3(): AWS.S3 {
  return new AWS.S3({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
  })
}

// Returns the public URL, or null if S3 is not configured (development mode)
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  if (!isS3Configured()) {
    console.warn('[S3] Skipping upload — AWS credentials not configured (development mode)')
    return null
  }

  const s3 = getS3()
  const bucket = env.AWS_S3_BUCKET!

  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
    .promise()

  return `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
}

export async function getSignedUrl(key: string, expiresSeconds = 3600): Promise<string> {
  if (!isS3Configured()) return ''

  const s3 = getS3()
  const bucket = env.AWS_S3_BUCKET!

  return s3.getSignedUrlPromise('getObject', {
    Bucket: bucket,
    Key: key,
    Expires: expiresSeconds,
  })
}

export function buildKey(producerId: string, type: string, filename: string): string {
  const date = new Date().toISOString().split('T')[0]
  return `producers/${producerId}/${type}/${date}/${filename}`
}
