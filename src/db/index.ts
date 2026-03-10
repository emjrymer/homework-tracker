import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: import.meta.env.TURSO_DATABASE_URL ?? 'file:local.db',
      authToken: import.meta.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
