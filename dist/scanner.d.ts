export interface ScanResult {
    file: string;
    line: number;
    column: number;
    original: string;
    replacement: string;
    context: string;
    type: "punctuation" | "fullwidth" | "chinese_char";
    shouldReplace: boolean;
    reason: string;
}
export interface ScanOptions {
    include?: string[];
    exclude?: string[];
    replacePunctuation?: boolean;
    replaceFullwidth?: boolean;
    replaceChineseChars?: boolean;
    dryRun?: boolean;
    contextAware?: boolean;
}
export interface StringSegment {
    content: string;
    isString: boolean;
    quote?: string;
    start: number;
    end: number;
}
declare const DEFAULT_EXCLUDE: string[];
declare const DEFAULT_INCLUDE: string[];
declare function parseStringSegments(line: string): StringSegment[];
declare function isChineseContentString(segment: StringSegment): boolean;
declare function isLikelyI18nKey(segment: StringSegment): boolean;
declare function isCommentContext(line: string, column: number): boolean;
export declare function scanLine(line: string, lineNumber: number, filePath: string, options: ScanOptions): ScanResult[];
export declare function scanContent(content: string, filePath: string, options: ScanOptions): ScanResult[];
export declare function replaceContent(content: string, filePath: string, options: ScanOptions): {
    content: string;
    results: ScanResult[];
};
export { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, parseStringSegments, isChineseContentString, isLikelyI18nKey, isCommentContext, };
//# sourceMappingURL=scanner.d.ts.map