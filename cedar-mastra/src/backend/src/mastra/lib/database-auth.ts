/**
 * Shared Database Authentication and Connection Management
 *
 * This module provides centralized PostgreSQL connection management with:
 * - Connection pooling for efficiency
 * - Automatic retry logic for resilience
 * - Environment variable validation
 * - Graceful error handling
 *
 * Similar to the scanner bridge tool authentication pattern
 */

import { Client, Pool } from 'pg';

// Environment variables with defaults
const DATABASE_URL = process.env.DATABASE_URL;
const SCANNER_SERVICE_URL = process.env.SCANNER_SERVICE_URL || 'http://localhost:8000';
const SCANNER_USERNAME = process.env.SCANNER_USERNAME || 'admin';
const SCANNER_PASSWORD = process.env.SCANNER_PASSWORD || 'password';

// Connection pool for PostgreSQL (reused across tools)
let pgPool: Pool | null = null;

// Scanner auth token cache (same as scanner bridge tool)
let authTokenCache: { token: string; expires: number } | null = null;

/**
 * Get or create PostgreSQL connection pool
 * Uses connection pooling for better performance and resource management
 */
export function getPostgresPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL environment variable is not configured. ' +
      'Please set DATABASE_URL to your PostgreSQL connection string.'
    );
  }

  if (!pgPool) {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Fail fast on connection
      statement_timeout: 60000, // 60 second statement timeout
      query_timeout: 60000, // 60 second query timeout
      ssl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('ssl=true')
        ? { rejectUnauthorized: false }
        : undefined,
    });

    // Handle pool errors
    pgPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });

    // Log successful connection
    pgPool.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database');
    });
  }

  return pgPool;
}

/**
 * Execute a query with automatic retry logic
 * Handles transient connection issues gracefully
 */
export async function executeQueryWithRetry(
  query: string,
  params?: any[],
  maxRetries: number = 3
): Promise<any> {
  const pool = getPostgresPool();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable =
        error instanceof Error && (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('connection terminated')
        );

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⚠️  Database query failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Query failed after retries');
}

/**
 * Get a standalone client for transactions or long-running operations
 * Caller is responsible for releasing the client
 */
export async function getDatabaseClient(): Promise<Client> {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL environment variable is not configured. ' +
      'Please set DATABASE_URL to your PostgreSQL connection string.'
    );
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 60000,
    query_timeout: 60000,
    ssl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('ssl=true')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    throw new Error(
      `Failed to connect to PostgreSQL database: ${error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Get authentication token for scanner API
 * Reused from scanner bridge tool with caching
 */
export async function getScannerAuthToken(): Promise<string> {
  // Check if we have a valid cached token
  if (authTokenCache && authTokenCache.expires > Date.now()) {
    return authTokenCache.token;
  }

  try {
    const response = await fetch(`${SCANNER_SERVICE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: SCANNER_USERNAME,
        password: SCANNER_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed with status ${response.status}`);
    }

    const data = await response.json();

    // Cache token for 50 minutes (tokens typically expire in 60 minutes)
    authTokenCache = {
      token: data.access_token,
      expires: Date.now() + (50 * 60 * 1000),
    };

    return data.access_token;
  } catch (error) {
    console.error('Failed to get scanner auth token:', error);
    throw new Error(`Scanner authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Make authenticated request to scanner API
 */
export async function fetchFromScanner(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getScannerAuthToken();

  return fetch(`${SCANNER_SERVICE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Close database connections (cleanup)
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    console.log('✅ PostgreSQL connection pool closed');
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getPostgresPool();
    const result = await pool.query('SELECT 1');
    return result.rows.length === 1;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Test scanner API connection
 */
export async function testScannerConnection(): Promise<boolean> {
  try {
    await getScannerAuthToken();
    return true;
  } catch (error) {
    console.error('Scanner API connection test failed:', error);
    return false;
  }
}

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  if (!process.env.SCANNER_SERVICE_URL) {
    warnings.push(`SCANNER_SERVICE_URL not set, using default: ${SCANNER_SERVICE_URL}`);
  }

  if (!process.env.SCANNER_USERNAME) {
    warnings.push(`SCANNER_USERNAME not set, using default: ${SCANNER_USERNAME}`);
  }

  if (!process.env.SCANNER_PASSWORD) {
    warnings.push('SCANNER_PASSWORD not set, using default password');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}