import mongoose from 'mongoose';

// Cached connection. Without this, every serverless invocation opens a new
// pool and Atlas M0 runs out of connections mid-event (architecture.md §9).
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _mongoose?: Cache };
const cache: Cache = g._mongoose ?? (g._mongoose = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, { maxPoolSize: 5, bufferCommands: false });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}
