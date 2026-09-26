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
  // Some Windows/router setups refuse Node's SRV lookups for mongodb+srv URIs.
  // Opt-in workaround for local runs: MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1
  if (process.env.MONGODB_DNS_SERVERS) {
    const dns = await import('dns');
    dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map((s) => s.trim()));
  }
  if (!cache.promise) {
    // Small pools per instance: under a spike Vercel runs many instances, and
    // Atlas M0 starts refusing TLS handshakes once connections pile up.
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 2,
      minPoolSize: 0,
      maxIdleTimeMS: 10_000,
      serverSelectionTimeoutMS: 8_000,
      bufferCommands: false,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}
