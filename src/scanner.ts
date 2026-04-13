import {
  CHINESE_CHAR_REGEX,
  CHINESE_PUNCTUATION_REGEX,
  CHINESE_PUNCTUATION_MAP,
  FULLWIDTH_CHAR_MAP,
} from "./mappings";

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

const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/coverage/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/package-lock.json",
  "**/yarn.lock",
];

const DEFAULT_INCLUDE = ["**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,json,md}"];

function parseStringSegments(line: string): StringSegment[] {
  const segments: StringSegment[] = [];
  let current = "";
  let inString = false;
  let quoteChar = "";
  let segmentStart = 0;
  let escape = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escape = true;
      continue;
    }

    if (!inString) {
      if (ch === '"' || ch === "'" || ch === "`") {
        if (current) {
          segments.push({
            content: current,
            isString: false,
            start: segmentStart,
            end: i,
          });
        }
        inString = true;
        quoteChar = ch;
        current = ch;
        segmentStart = i;
      } else {
        current += ch;
      }
    } else {
      current += ch;
      if (ch === quoteChar) {
        segments.push({
          content: current,
          isString: true,
          quote: quoteChar,
          start: segmentStart,
          end: i + 1,
        });
        inString = false;
        current = "";
        segmentStart = i + 1;
      }
    }
  }

  if (current) {
    segments.push({
      content: current,
      isString: inString,
      quote: inString ? quoteChar : undefined,
      start: segmentStart,
      end: line.length,
    });
  }

  return segments;
}

function isChineseContentString(segment: StringSegment): boolean {
  if (!segment.isString) return false;

  const content = segment.content.slice(1, -1);
  const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalNonSpace = content.replace(/\s/g, "").length;

  if (totalNonSpace === 0) return false;

  if (chineseCharCount / totalNonSpace > 0.3) {
    return true;
  }

  return false;
}

function isLikelyI18nKey(segment: StringSegment): boolean {
  if (!segment.isString) return false;
  const content = segment.content.slice(1, -1).trim();

  if (/^[a-zA-Z][\w.]*$/.test(content)) return true;
  if (/^\w+\.\w+/.test(content)) return true;

  return false;
}

function isCommentContext(line: string, column: number): boolean {
  const before = line.slice(0, column).trimStart();
  if (
    before.startsWith("//") ||
    before.startsWith("*") ||
    before.startsWith("/*")
  )
    return true;
  if (before.startsWith("#") && !before.includes('"') && !before.includes("'"))
    return true;
  if (before.startsWith("<!--")) return true;
  return false;
}

function analyzeReplacement(
  char: string,
  line: string,
  column: number,
  segment: StringSegment | null,
  options: ScanOptions,
): {
  replacement: string;
  type: ScanResult["type"];
  shouldReplace: boolean;
  reason: string;
} {
  let replacement = "";
  let type: ScanResult["type"] = "punctuation";
  let shouldReplace = false;
  let reason = "";

  if (CHINESE_PUNCTUATION_MAP[char]) {
    type = "punctuation";
    replacement = CHINESE_PUNCTUATION_MAP[char];

    if (!options.replacePunctuation) {
      return {
        replacement,
        type,
        shouldReplace: false,
        reason: "标点替换未启用",
      };
    }

    if (segment && segment.isString && isChineseContentString(segment)) {
      shouldReplace = false;
      reason = "中文内容字符串中的标点应保留";
    } else if (segment && segment.isString && isLikelyI18nKey(segment)) {
      shouldReplace = false;
      reason = "i18n key 中的字符应保留";
    } else if (isCommentContext(line, column)) {
      shouldReplace = false;
      reason = "注释中的中文标点应保留";
    } else {
      shouldReplace = true;
      reason = "代码/非中文上下文中的中文标点应替换";
    }
  } else if (FULLWIDTH_CHAR_MAP[char]) {
    type = "fullwidth";
    replacement = FULLWIDTH_CHAR_MAP[char];

    if (!options.replaceFullwidth) {
      return {
        replacement,
        type,
        shouldReplace: false,
        reason: "全角字符替换未启用",
      };
    }

    if (segment && segment.isString && isChineseContentString(segment)) {
      shouldReplace = false;
      reason = "中文内容字符串中的全角字符应保留";
    } else {
      shouldReplace = true;
      reason = "非中文上下文中的全角字符应替换";
    }
  } else if (CHINESE_CHAR_REGEX.test(char)) {
    type = "chinese_char";
    replacement = `[TODO:${char}]`;

    if (!options.replaceChineseChars) {
      return {
        replacement,
        type,
        shouldReplace: false,
        reason: "中文字符替换未启用",
      };
    }

    if (segment && segment.isString) {
      if (isChineseContentString(segment)) {
        shouldReplace = false;
        reason = "中文内容字符串中的汉字应保留";
      } else if (isLikelyI18nKey(segment)) {
        shouldReplace = false;
        reason = "i18n key 中不应包含汉字";
      } else {
        shouldReplace = true;
        reason = "非中文上下文中的孤立汉字需要翻译";
      }
    } else if (isCommentContext(line, column)) {
      shouldReplace = false;
      reason = "注释中的汉字应保留";
    } else {
      shouldReplace = true;
      reason = "代码中的汉字需要翻译";
    }
  }

  return { replacement, type, shouldReplace, reason };
}

export function scanLine(
  line: string,
  lineNumber: number,
  filePath: string,
  options: ScanOptions,
): ScanResult[] {
  const results: ScanResult[] = [];
  const segments =
    options.contextAware !== false ? parseStringSegments(line) : [];

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    const isChinesePunct = CHINESE_PUNCTUATION_REGEX.test(char);
    const isFullwidth = FULLWIDTH_CHAR_MAP[char] !== undefined;
    const isChineseChar = CHINESE_CHAR_REGEX.test(char);

    if (!isChinesePunct && !isFullwidth && !isChineseChar) continue;

    if (char === "—" && i + 1 < line.length && line[i + 1] === "—") {
      const analysis = analyzeReplacement("——", line, i, null, options);
      results.push({
        file: filePath,
        line: lineNumber,
        column: i + 1,
        original: "——",
        replacement: analysis.replacement,
        context: line.trim(),
        type: analysis.type,
        shouldReplace: analysis.shouldReplace,
        reason: analysis.reason,
      });
      i++;
      continue;
    }

    let segment: StringSegment | null = null;
    for (const seg of segments) {
      if (i >= seg.start && i < seg.end) {
        segment = seg;
        break;
      }
    }

    const analysis = analyzeReplacement(char, line, i, segment, options);
    results.push({
      file: filePath,
      line: lineNumber,
      column: i + 1,
      original: char,
      replacement: analysis.replacement,
      context: line.trim(),
      type: analysis.type,
      shouldReplace: analysis.shouldReplace,
      reason: analysis.reason,
    });
  }

  return results;
}

export function scanContent(
  content: string,
  filePath: string,
  options: ScanOptions,
): ScanResult[] {
  const lines = content.split("\n");
  const results: ScanResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    results.push(...scanLine(lines[i], i + 1, filePath, options));
  }

  return results;
}

export function replaceContent(
  content: string,
  filePath: string,
  options: ScanOptions,
): { content: string; results: ScanResult[] } {
  const results = scanContent(content, filePath, options);
  const replaceable = results.filter((r) => r.shouldReplace);

  if (replaceable.length === 0) {
    return { content, results };
  }

  const lines = content.split("\n");
  const lineReplacements = new Map<number, ScanResult[]>();

  for (const r of replaceable) {
    if (!lineReplacements.has(r.line - 1)) {
      lineReplacements.set(r.line - 1, []);
    }
    lineReplacements.get(r.line - 1)!.push(r);
  }

  for (const [lineIdx, replacements] of lineReplacements) {
    let line = lines[lineIdx];
    const sorted = replacements.sort((a, b) => b.column - a.column);

    for (const r of sorted) {
      const col = r.column - 1;
      line =
        line.slice(0, col) +
        r.replacement +
        line.slice(col + r.original.length);
    }

    lines[lineIdx] = line;
  }

  return { content: lines.join("\n"), results };
}

export {
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  parseStringSegments,
  isChineseContentString,
  isLikelyI18nKey,
  isCommentContext,
};
