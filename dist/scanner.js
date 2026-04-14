"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INCLUDE = exports.DEFAULT_EXCLUDE = void 0;
exports.scanLine = scanLine;
exports.scanContent = scanContent;
exports.replaceContent = replaceContent;
exports.parseStringSegments = parseStringSegments;
exports.isChineseContentString = isChineseContentString;
exports.isLikelyI18nKey = isLikelyI18nKey;
exports.isCommentContext = isCommentContext;
const mappings_1 = require("./mappings");
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
exports.DEFAULT_EXCLUDE = DEFAULT_EXCLUDE;
const DEFAULT_INCLUDE = ["**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,json,md}"];
exports.DEFAULT_INCLUDE = DEFAULT_INCLUDE;
function parseStringSegments(line) {
    const segments = [];
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
            }
            else {
                current += ch;
            }
        }
        else {
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
function isChineseContentString(segment) {
    if (!segment.isString)
        return false;
    const content = segment.content.slice(1, -1);
    const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalNonSpace = content.replace(/\s/g, "").length;
    if (totalNonSpace === 0)
        return false;
    if (chineseCharCount / totalNonSpace > 0.3) {
        return true;
    }
    return false;
}
function isLikelyI18nKey(segment) {
    if (!segment.isString)
        return false;
    const content = segment.content.slice(1, -1).trim();
    if (/^[a-zA-Z][\w.]*$/.test(content))
        return true;
    if (/^\w+\.\w+/.test(content))
        return true;
    return false;
}
function isCommentContext(line, column) {
    const before = line.slice(0, column).trimStart();
    if (before.startsWith("//") ||
        before.startsWith("*") ||
        before.startsWith("/*"))
        return true;
    if (before.startsWith("#") && !before.includes('"') && !before.includes("'"))
        return true;
    if (before.startsWith("<!--"))
        return true;
    return false;
}
function analyzeReplacement(char, line, column, segment, options) {
    let replacement = "";
    let type = "punctuation";
    let shouldReplace = false;
    let reason = "";
    if (mappings_1.CHINESE_PUNCTUATION_MAP[char]) {
        type = "punctuation";
        replacement = mappings_1.CHINESE_PUNCTUATION_MAP[char];
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
        }
        else if (segment && segment.isString && isLikelyI18nKey(segment)) {
            shouldReplace = false;
            reason = "i18n key 中的字符应保留";
        }
        else if (isCommentContext(line, column)) {
            shouldReplace = false;
            reason = "注释中的中文标点应保留";
        }
        else {
            shouldReplace = true;
            reason = "代码/非中文上下文中的中文标点应替换";
        }
    }
    else if (mappings_1.FULLWIDTH_CHAR_MAP[char]) {
        type = "fullwidth";
        replacement = mappings_1.FULLWIDTH_CHAR_MAP[char];
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
        }
        else {
            shouldReplace = true;
            reason = "非中文上下文中的全角字符应替换";
        }
    }
    else if (mappings_1.CHINESE_CHAR_REGEX.test(char)) {
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
            }
            else if (isLikelyI18nKey(segment)) {
                shouldReplace = false;
                reason = "i18n key 中不应包含汉字";
            }
            else {
                shouldReplace = true;
                reason = "非中文上下文中的孤立汉字需要翻译";
            }
        }
        else if (isCommentContext(line, column)) {
            shouldReplace = false;
            reason = "注释中的汉字应保留";
        }
        else {
            shouldReplace = true;
            reason = "代码中的汉字需要翻译";
        }
    }
    return { replacement, type, shouldReplace, reason };
}
function scanLine(line, lineNumber, filePath, options) {
    const results = [];
    const segments = options.contextAware !== false ? parseStringSegments(line) : [];
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const isChinesePunct = mappings_1.CHINESE_PUNCTUATION_REGEX.test(char);
        const isFullwidth = mappings_1.FULLWIDTH_CHAR_MAP[char] !== undefined;
        const isChineseChar = mappings_1.CHINESE_CHAR_REGEX.test(char);
        if (!isChinesePunct && !isFullwidth && !isChineseChar)
            continue;
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
        let segment = null;
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
function scanContent(content, filePath, options) {
    const lines = content.split("\n");
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        results.push(...scanLine(lines[i], i + 1, filePath, options));
    }
    return results;
}
function replaceContent(content, filePath, options) {
    const results = scanContent(content, filePath, options);
    const replaceable = results.filter((r) => r.shouldReplace);
    if (replaceable.length === 0) {
        return { content, results };
    }
    const lines = content.split("\n");
    const lineReplacements = new Map();
    for (const r of replaceable) {
        if (!lineReplacements.has(r.line - 1)) {
            lineReplacements.set(r.line - 1, []);
        }
        lineReplacements.get(r.line - 1).push(r);
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
//# sourceMappingURL=scanner.js.map