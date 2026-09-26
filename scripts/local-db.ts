/**
 * npm run db:local — a throwaway MongoDB on 127.0.0.1:27017 for development,
 * so you can play the game before an Atlas cluster exists. Data persists in
 * .localdb/ between runs. Production always uses Atlas.
 */
import { mkdirSync } from 'fs';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  const dbPath = path.join(process.cwd(), '.localdb');
  mkdirSync(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: 27017, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
  console.log(`Local MongoDB running at ${server.getUri()}echo`);
  console.log('Ctrl+C to stop.');
  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
