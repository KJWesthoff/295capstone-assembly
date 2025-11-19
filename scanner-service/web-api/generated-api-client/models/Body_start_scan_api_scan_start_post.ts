/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Body_start_scan_api_scan_start_post = {
    server_url: string;
    target_url?: (string | null);
    rps?: number;
    max_requests?: number;
    dangerous?: boolean;
    fuzz_auth?: boolean;
    scanners?: string;
    spec_file?: (Blob | null);
};

