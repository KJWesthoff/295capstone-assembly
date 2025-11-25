/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScanStatus = {
    scan_id: string;
    status: string;
    progress?: number;
    current_phase?: string;
    findings_count?: number;
    parallel_mode?: boolean;
    total_chunks?: number;
    chunk_status?: Array<Record<string, any>>;
    job_ids?: Array<string>;
    queue_stats?: Record<string, any>;
};

