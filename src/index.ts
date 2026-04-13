import * as fs from "fs";
import * as path from "path";
import glob from "glob";
import { promisify } from "util";
import {
  scanContent,
  replaceContent,
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  ScanOptions,
  ScanResult,
} from "./scanner";

const globAsync = promisify(glob);

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

async function globFiles(
  includePatterns: string[],
  excludePatterns: string[],
  rootDir: string,
): Promise<string[]> {
  const allFiles: Set<string> = new Set();

  for (const pattern of includePatterns) {
    try {
      const matches = (await globAsync(pattern, {
        cwd: rootDir,
        ignore: excludePatterns,
        absolute: true,
        nodir: true,
      })) as string[];
      for (const m of matches) {
        allFiles.add(m);
      }
    } catch (err) {
      // skip invalid patterns
    }
  }

  return Array.from(allFiles);
}

export async function scanProject(
  rootDir: string,
  options: ScanOptions = {},
): Promise<ProjectScanResult> {
  const includePatterns = options.include || DEFAULT_INCLUDE;
  const excludePatterns = options.exclude || DEFAULT_EXCLUDE;

  const files = await globFiles(includePatterns, excludePatterns, rootDir);

  const fileResults: FileScanResult[] = [];
  let totalFindings = 0;
  let replaceable = 0;
  const byType: Record<string, number> = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const results = scanContent(content, file, {
        ...options,
        contextAware: options.contextAware !== false,
      });

      if (results.length > 0) {
        fileResults.push({ file, results, replaced: false });
        totalFindings += results.length;
        for (const r of results) {
          if (r.shouldReplace) replaceable++;
          byType[r.type] = (byType[r.type] || 0) + 1;
        }
      }
    } catch (err) {
      // skip unreadable files
    }
  }

  return {
    totalFiles: files.length,
    scannedFiles: files.length,
    results: fileResults,
    summary: { totalFindings, replaceable, byType },
  };
}

export async function replaceProject(
  rootDir: string,
  options: ScanOptions = {},
): Promise<ProjectScanResult> {
  const includePatterns = options.include || DEFAULT_INCLUDE;
  const excludePatterns = options.exclude || DEFAULT_EXCLUDE;

  const files = await globFiles(includePatterns, excludePatterns, rootDir);

  const fileResults: FileScanResult[] = [];
  let totalFindings = 0;
  let replaceable = 0;
  const byType: Record<string, number> = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const { content: newContent, results } = replaceContent(content, file, {
        ...options,
        contextAware: options.contextAware !== false,
      });

      if (results.length > 0) {
        const wasReplaced = newContent !== content;
        if (wasReplaced && !options.dryRun) {
          fs.writeFileSync(file, newContent, "utf-8");
        }
        fileResults.push({
          file,
          results,
          replaced: wasReplaced && !options.dryRun,
        });
        totalFindings += results.length;
        for (const r of results) {
          if (r.shouldReplace) replaceable++;
          byType[r.type] = (byType[r.type] || 0) + 1;
        }
      }
    } catch (err) {
      // skip unreadable files
    }
  }

  return {
    totalFiles: files.length,
    scannedFiles: files.length,
    results: fileResults,
    summary: { totalFindings, replaceable, byType },
  };
}

export { scanContent, replaceContent, ScanOptions, ScanResult };
