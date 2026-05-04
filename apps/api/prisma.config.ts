import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const databaseUrl = process.env.DATABASE_URL as string

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrate: {
    async adapter() {
      const pool = new Pool({ connectionString: databaseUrl })
      return new PrismaPg(pool)
    },
  },
})
