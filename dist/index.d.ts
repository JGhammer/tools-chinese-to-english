import { scanContent, replaceContent, ScanOptions, ScanResult } from "./scanner";
export interface FileScanResult {
    file: string;
    results: ScanResult[];
    replaced: boolean;
}
export interface ProjectScanResult {
    totalFiles: number;
    scannedFiles: number;
    results: FileScanResult[];
    summary: {
        totalFindings: number;
        replaceable: number;
        byType: Record<string, number>;
    };
}
export declare function scanProject(rootDir: string, options?: ScanOptions): Promise<ProjectScanResult>;
export declare function replaceProject(rootDir: string, options?: ScanOptions): Promise<ProjectScanResult>;
export { scanContent, replaceContent, ScanOptions, ScanResult };
//# sourceMappingURL=index.d.ts.map