/**
 * Guardrails API Route
 *
 * Fetches security guardrail rules from Semgrep Registry based on CWE or keyword.
 * These rules can be integrated into CI/CD pipelines to prevent vulnerabilities.
 *
 * Query parameters:
 * - cwe: CWE ID (e.g., "CWE-89" or "89")
 * - keyword: Search keyword (e.g., "sql injection")
 * - language: Programming language filter (e.g., "python", "javascript")
 * - limit: Maximum number of rules to return (default: 3)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getGuardrailsByCWE,
  getGuardrailsByKeyword,
  getGuardrailsForFinding,
} from '@/backend/src/mastra/lib/semgrep-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const cwe = searchParams.get('cwe');
  const cweList = searchParams.get('cwes'); // comma-separated list
  const keyword = searchParams.get('keyword');
  const language = searchParams.get('language') || undefined;
  const limit = parseInt(searchParams.get('limit') || '3', 10);

  try {
    // Validate input
    if (!cwe && !cweList && !keyword) {
      return NextResponse.json(
        {
          error: 'Missing required parameter',
          message: 'Please provide either "cwe", "cwes", or "keyword" query parameter',
          examples: [
            '/api/guardrails?cwe=CWE-89&language=python',
            '/api/guardrails?cwes=CWE-89,CWE-79&language=javascript',
            '/api/guardrails?keyword=sql+injection',
          ],
        },
        { status: 400 }
      );
    }

    let guardrails: Awaited<ReturnType<typeof getGuardrailsByCWE>> = [];

    if (cweList) {
      // Multiple CWEs
      const cweIds = cweList.split(',').map(c => c.trim());
      guardrails = await getGuardrailsForFinding(cweIds, language, limit);
    } else if (cwe) {
      // Single CWE
      guardrails = await getGuardrailsByCWE(cwe, language, limit);
    } else if (keyword) {
      // Keyword search
      guardrails = await getGuardrailsByKeyword(keyword, language, limit);
    }

    return NextResponse.json({
      guardrails,
      total: guardrails.length,
      searchCriteria: {
        cwe: cwe || cweList,
        keyword,
        language,
        limit,
      },
      source: 'semgrep-registry',
    });
  } catch (error: any) {
    console.error('Error fetching guardrails:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch guardrails',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
