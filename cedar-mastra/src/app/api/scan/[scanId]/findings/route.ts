/**
 * Findings API Route
 *
 * Fetches raw scanner findings from Python scanner service,
 * transforms them using scanner-transform library,
 * returns enriched Finding objects to frontend.
 *
 * Implements "Option C" pattern - reusable transformation logic
 * that can also be called by Mastra tools for AI agent access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scannerApi } from '@/lib/scannerApi';
import { transformFindings } from '@/lib/scanner-transform';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;

  try {

    if (!scanId) {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    // Manually authenticate since API routes run on server (no localStorage)
    const username = process.env.NEXT_PUBLIC_SCANNER_USERNAME || 'MICS295';
    const password = process.env.NEXT_PUBLIC_SCANNER_PASSWORD || 'MaryMcHale';
    const serviceUrl = process.env.SCANNER_SERVICE_URL || process.env.NEXT_PUBLIC_SCANNER_SERVICE_URL || 'http://localhost:8000';

    // Get auth token
    const loginResponse = await fetch(`${serviceUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!loginResponse.ok) {
      return NextResponse.json(
        { error: 'Authentication failed', message: 'Could not authenticate with scanner service' },
        { status: 401 }
      );
    }

    const { access_token } = await loginResponse.json();

    // Fetch raw findings from scanner service with auth header
    const findingsUrl = `${serviceUrl}/api/scan/${scanId}/findings`;
    const rawResponse = await fetch(findingsUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!rawResponse.ok) {
      return NextResponse.json(
        { error: 'Scan not found', message: `No scan found with ID: ${scanId}` },
        { status: 404 }
      );
    }

    const rawData = await rawResponse.json();

    if (!rawData || !rawData.findings) {
      return NextResponse.json(
        { error: 'No findings returned from scanner service' },
        { status: 404 }
      );
    }

    // Get scan status to retrieve scan timestamp
    const statusUrl = `${serviceUrl}/api/scan/${scanId}/status`;
    const statusResponse = await fetch(statusUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const scanStatus = statusResponse.ok ? await statusResponse.json() : {};
    const scanTimestamp = scanStatus.created_at || new Date().toISOString();

    // Transform raw findings using scanner-transform library
    const enrichedFindings = transformFindings(rawData.findings, scanTimestamp);

    return NextResponse.json({
      findings: enrichedFindings,
      total: enrichedFindings.length,
      scan_id: scanId,
      scan_timestamp: scanTimestamp,
    });

  } catch (error: any) {
    console.error('Error fetching findings:', error);

    // Handle specific error cases
    if (error.message?.includes('Scanner service is not running')) {
      return NextResponse.json(
        {
          error: 'Scanner service unavailable',
          message: 'Please ensure the scanner service is running at http://localhost:8000'
        },
        { status: 503 }
      );
    }

    if (error.message?.includes('Failed to authenticate')) {
      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: 'Could not authenticate with scanner service'
        },
        { status: 401 }
      );
    }

    if (error.message?.includes('Failed to get findings')) {
      return NextResponse.json(
        {
          error: 'Scan not found',
          message: `No scan found with ID: ${scanId}`
        },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
