import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Safely serialize objects containing Prisma BigInt or Date fields to JSON-safe values.
 */
export function serializePrisma<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === 'bigint') {
        return Number(value)
      }
      return value
    })
  )
}

