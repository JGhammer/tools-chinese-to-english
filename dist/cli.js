#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const path = __importStar(require("path"));
const index_1 = require("./index");
const program = new commander_1.Command();
function splitPatterns(input) {
    const patterns = [];
    let depth = 0;
    let current = "";
    for (const ch of input) {
        if (ch === "{")
            depth++;
        else if (ch === "}")
            depth--;
        if (ch === "," && depth === 0) {
            patterns.push(current.trim());
            current = "";
        }
        else {
            current += ch;
        }
    }
    if (current.trim()) {
        patterns.push(current.trim());
    }
    return patterns;
}
program
    .name("c2e")
    .description("Scan and replace Chinese characters in your project with English equivalents")
    .version("1.0.0");
program
    .command("scan")
    .description("Scan for Chinese characters in the project")
    .argument("[dir]", "project directory", ".")
    .option("--include <patterns>", "glob patterns to include (comma-separated)", "**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,json,md}")
    .option("--exclude <patterns>", "glob patterns to exclude (comma-separated)", "**/node_modules/**,**/dist/**,**/build/**,**/.git/**")
    .option("--no-punctuation", "do not replace Chinese punctuation")
    .option("--no-fullwidth", "do not replace fullwidth characters")
    .option("--chinese-chars", "also flag Chinese characters for translation")
    .option("--no-context-aware", "disable context-aware detection")
    .action(async (dir, opts) => {
    const rootDir = path.resolve(dir);
    console.log(chalk_1.default.blue(`\n🔍 Scanning project at: ${rootDir}\n`));
    const options = {
        include: splitPatterns(opts.include),
        exclude: splitPatterns(opts.exclude),
        replacePunctuation: opts.punctuation !== false,
        replaceFullwidth: opts.fullwidth !== false,
        replaceChineseChars: opts.chineseChars || false,
        contextAware: opts.contextAware !== false,
        dryRun: true,
    };
    try {
        const result = await (0, index_1.scanProject)(rootDir, options);
        if (result.results.length === 0) {
            console.log(chalk_1.default.green("✅ No Chinese characters found!"));
            return;
        }
        console.log(chalk_1.default.yellow(`Found ${result.summary.totalFindings} Chinese character(s) in ${result.results.length} file(s):\n`));
        for (const fileResult of result.results) {
            const relPath = path.relative(rootDir, fileResult.file);
            console.log(chalk_1.default.cyan(`📄 ${relPath}`));
            for (const r of fileResult.results) {
                const icon = r.shouldReplace ? chalk_1.default.red("✗") : chalk_1.default.green("✓");
                const typeLabel = {
                    punctuation: "标点",
                    fullwidth: "全角",
                    chinese_char: "汉字",
                }[r.type];
                console.log(`  ${icon} L${r.line}:${r.column} ${chalk_1.default.yellow(`[${typeLabel}]`)} "${chalk_1.default.red(r.original)}" → "${chalk_1.default.green(r.replacement)}" ${chalk_1.default.gray(r.reason)}`);
            }
            console.log();
        }
        console.log(chalk_1.default.blue("--- Summary ---"));
        console.log(`  Total findings: ${result.summary.totalFindings}`);
        console.log(`  Replaceable: ${chalk_1.default.red(result.summary.replaceable)}`);
        console.log(`  Should keep: ${chalk_1.default.green(result.summary.totalFindings - result.summary.replaceable)}`);
        console.log(`  By type: ${JSON.stringify(result.summary.byType)}`);
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error: ${err.message}`));
        process.exit(1);
    }
});
program
    .command("replace")
    .description("Replace Chinese characters with English equivalents")
    .argument("[dir]", "project directory", ".")
    .option("--include <patterns>", "glob patterns to include (comma-separated)", "**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,json,md}")
    .option("--exclude <patterns>", "glob patterns to exclude (comma-separated)", "**/node_modules/**,**/dist/**,**/build/**,**/.git/**")
    .option("--no-punctuation", "do not replace Chinese punctuation")
    .option("--no-fullwidth", "do not replace fullwidth characters")
    .option("--chinese-chars", "also replace Chinese characters")
    .option("--no-context-aware", "disable context-aware detection")
    .option("--dry-run", "preview changes without writing files")
    .action(async (dir, opts) => {
    const rootDir = path.resolve(dir);
    const isDryRun = opts.dryRun || false;
    console.log(chalk_1.default.blue(`\n🔧 ${isDryRun ? "[DRY RUN] " : ""}Replacing Chinese characters in: ${rootDir}\n`));
    const options = {
        include: splitPatterns(opts.include),
        exclude: splitPatterns(opts.exclude),
        replacePunctuation: opts.punctuation !== false,
        replaceFullwidth: opts.fullwidth !== false,
        replaceChineseChars: opts.chineseChars || false,
        contextAware: opts.contextAware !== false,
        dryRun: isDryRun,
    };
    try {
        const result = await (0, index_1.replaceProject)(rootDir, options);
        if (result.summary.replaceable === 0) {
            console.log(chalk_1.default.green("✅ No replaceable Chinese characters found!"));
            return;
        }
        for (const fileResult of result.results) {
            const replaceable = fileResult.results.filter((r) => r.shouldReplace);
            if (replaceable.length === 0)
                continue;
            const relPath = path.relative(rootDir, fileResult.file);
            const status = fileResult.replaced
                ? chalk_1.default.green("✓ replaced")
                : chalk_1.default.yellow("⏳ dry run");
            console.log(`${status} ${chalk_1.default.cyan(relPath)} (${replaceable.length} change(s))`);
            for (const r of replaceable) {
                console.log(`    L${r.line} "${chalk_1.default.red(r.original)}" → "${chalk_1.default.green(r.replacement)}"`);
            }
        }
        console.log(chalk_1.default.blue("\n--- Summary ---"));
        console.log(`  Replaced: ${isDryRun ? chalk_1.default.yellow("(dry run) ") : ""}${result.summary.replaceable}`);
        console.log(`  Kept: ${result.summary.totalFindings - result.summary.replaceable}`);
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error: ${err.message}`));
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map