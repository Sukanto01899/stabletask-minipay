import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI environment variable.')
}

type GlobalMongoose = typeof globalThis & {
  mongooseCache?: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  }
}

const globalWithMongoose = globalThis as GlobalMongoose

const cache = globalWithMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
}

globalWithMongoose.mongooseCache = cache

export async function connectToDatabase() {
  const mongoUri = MONGODB_URI

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI environment variable.')
  }

  if (cache.conn) {
    return cache.conn
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(mongoUri, {
      bufferCommands: false,
    })
  }

  cache.conn = await cache.promise
  return cache.conn
}
