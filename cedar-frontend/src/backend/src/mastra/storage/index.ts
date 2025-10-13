import { PostgresStore } from '@mastra/pg';

export const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL || 'postgresql://rag_user:rag_pass@postgres:5432/rag_db',
});
