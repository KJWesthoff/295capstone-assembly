import { LibSQLStore } from '@mastra/libsql';
import path from 'path';

// Using LibSQL for AI tracing support
// Note: PostgresStore v0.17.2 doesn't properly report AI tracing capability
// TODO: Switch back to PostgresStore when it's updated to support AI tracing

// Use different paths for Docker vs local development
const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/mastra.db'  // Docker container path
  : path.join(process.cwd(), 'mastra.db'); // Local development path

export const storage = new LibSQLStore({
  url: `file:${dbPath}`,
