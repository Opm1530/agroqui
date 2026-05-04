import IORedis from 'ioredis'
import { env } from './env'

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})
