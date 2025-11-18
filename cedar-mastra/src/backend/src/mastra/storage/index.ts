import { PostgresStore } from '@mastra/pg';

// Using PostgresStore for storage
// Note: LibSQLStore was causing import errors, using PostgresStore which is already configured
// PostgresStore works with the existing DATABASE_URL environment variable

// Ensure SSL is disabled in connection string for Docker internal connections
const baseConnectionString = process.env.DATABASE_URL || 'postgresql://rag_user:rag_pass@postgres:5432/rag_db';
const connectionString = baseConnectionString.includes('?') 
  ? `${baseConnectionString}&sslmode=disable`
  : `${baseConnectionString}?sslmode=disable`;

export const storage = new PostgresStore({
  connectionString,
});
