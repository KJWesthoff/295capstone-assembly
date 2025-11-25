/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_start_scan_api_scan_start_post } from '../models/Body_start_scan_api_scan_start_post';
import type { LoginRequest } from '../models/LoginRequest';
import type { ScanResponse } from '../models/ScanResponse';
import type { ScanStatus } from '../models/ScanStatus';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health Check
     * Health check endpoint for Railway
     * @returns any Successful Response
     * @throws ApiError
     */
    public static healthCheckHealthGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
        });
    }
    /**
     * Login
     * Authenticate user and return JWT token
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static loginApiAuthLoginPost(
        requestBody: LoginRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Start Scan
     * Start a new security scan using job queue
     * @param formData
     * @returns ScanResponse Successful Response
     * @throws ApiError
     */
    public static startScanApiScanStartPost(
        formData: Body_start_scan_api_scan_start_post,
    ): CancelablePromise<ScanResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scan/start',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Scan Status
     * Get current scan status with job queue information
     * @param scanId
     * @returns ScanStatus Successful Response
     * @throws ApiError
     */
    public static getScanStatusApiScanScanIdStatusGet(
        scanId: string,
    ): CancelablePromise<ScanStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scan/{scan_id}/status',
            path: {
                'scan_id': scanId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Scan Findings
     * Get scan findings from actual scanner output files
     * @param scanId
     * @param offset
     * @param limit
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getScanFindingsApiScanScanIdFindingsGet(
        scanId: string,
        offset?: number,
        limit: number = 50,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scan/{scan_id}/findings',
            path: {
                'scan_id': scanId,
            },
            query: {
                'offset': offset,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Scan Report
     * Get comprehensive scan report with scanner attribution
     * @param scanId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getScanReportApiScanScanIdReportGet(
        scanId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scan/{scan_id}/report',
            path: {
                'scan_id': scanId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Scan Report Html
     * Get HTML formatted scan report for download
     * @param scanId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getScanReportHtmlApiScanScanIdReportHtmlGet(
        scanId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scan/{scan_id}/report/html',
            path: {
                'scan_id': scanId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Scans
     * List all scans for the user
     * @returns any Successful Response
     * @throws ApiError
     */
    public static listScansApiScansGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scans',
        });
    }
    /**
     * Delete Scan
     * Delete a scan and cleanup job data
     * @param scanId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteScanApiScanScanIdDelete(
        scanId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/scan/{scan_id}',
            path: {
                'scan_id': scanId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Queue Stats
     * Get queue statistics (admin only)
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getQueueStatsApiQueueStatsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/queue/stats',
        });
    }
    /**
     * Get Available Scanners
     * Get list of available scanner engines
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getAvailableScannersApiScannersGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scanners',
        });
    }
    /**
     * Cleanup Old Jobs
     * Cleanup old job data (admin only)
     * @returns any Successful Response
     * @throws ApiError
     */
    public static cleanupOldJobsApiQueueCleanupPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/queue/cleanup',
        });
    }
}
