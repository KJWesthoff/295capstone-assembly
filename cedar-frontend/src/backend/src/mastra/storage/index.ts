import { LibSQLStore } from '@mastra/libsql';

// Using LibSQL for AI tracing support
// Note: PostgresStore v0.17.2 doesn't properly report AI tracing capability
// TODO: Switch back to PostgresStore when it's updated to support AI tracing
export const storage = new LibSQLStore({
  url: 'file:/app/mastra.db', // Persistent file storage in container
});
