#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import * as path from "path";
import { scanProject, replaceProject } from "./index";

const program = new Command();

function splitPatterns(input: string): string[] {
  const patterns: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of input) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (ch === "," && depth === 0) {
      patterns.push(current.trim());
      current = "";
    } else {
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
  .description(
    "Scan and replace Chinese characters in your project with English equivalents",
  )
  .version("1.0.0");

program
  .command("scan")
  .description("Scan for Chinese characters in the project")
  .argument("[dir]", "project directory", ".")
  .option(
    "--include <patterns>",
    "glob patterns to include (comma-separated)",
    "**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,json,md}",
  )
  .option(
    "--exclude <patterns>",
    "glob patterns to exclude (comma-separated)",
    "**/node_modules/**,**/dist/**,**/build/**,**/.git/**",
  )
  .option("--no-punctuation", "do not replace Chinese punctuation")
  .option("--no-fullwidth", "do not replace fullwidth characters")
  .option("--chinese-chars", "also flag Chinese characters for translation")
  .option("--no-context-aware", "disable context-aware detection")
  .action(async (dir: string, opts: any) => {
    const rootDir = path.resolve(dir);
    console.log(chalk.blue(`\n🔍 Scanning project at: ${rootDir}\n`));

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
      const result = await scanProject(rootDir, options);

      if (result.results.length === 0) {
        console.log(chalk.green("✅ No Chinese characters found!"));
        return;
      }

      console.log(
        chalk.yellow(
          `Found ${result.summary.totalFindings} Chinese character(s) in ${result.results.length} file(s):\n`,
        ),
      );

      for (const fileResult of result.results) {
        const relPath = path.relative(rootDir, fileResult.file);
        console.log(chalk.cyan(`📄 ${relPath}`));

        for (const r of fileResult.results) {
          const icon = r.shouldReplace ? chalk.red("✗") : chalk.green("✓");
          const typeLabel = {
            punctuation: "标点",
            fullwidth: "全角",
            chinese_char: "汉字",
          }[r.type];

          console.log(
            `  ${icon} L${r.line}:${r.column} ${chalk.yellow(`[${typeLabel}]`)} "${chalk.red(r.original)}" → "${chalk.green(r.replacement)}" ${chalk.gray(r.reason)}`,
          );
        }
        console.log();
      }

      console.log(chalk.blue("--- Summary ---"));
      console.log(`  Total findings: ${result.summary.totalFindings}`);
      console.log(`  Replaceable: ${chalk.red(result.summary.replaceable)}`);
      console.log(
        `  Should keep: ${chalk.green(result.summary.totalFindings - result.summary.replaceable)}`,
      );
      console.log(`  By type: ${JSON.stringify(result.summary.byType)}`);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("replace")
  .description("Replace Chinese characters with English equivalents")
  .argument("[dir]", "project directory", ".")
  .option(
    "--include <patterns>",
    "glob patterns to include (comma-separated)",
    "**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,json,md}",
  )
  .option(
    "--exclude <patterns>",
    "glob patterns to exclude (comma-separated)",
    "**/node_modules/**,**/dist/**,**/build/**,**/.git/**",
  )
  .option("--no-punctuation", "do not replace Chinese punctuation")
  .option("--no-fullwidth", "do not replace fullwidth characters")
  .option("--chinese-chars", "also replace Chinese characters")
  .option("--no-context-aware", "disable context-aware detection")
  .option("--dry-run", "preview changes without writing files")
  .action(async (dir: string, opts: any) => {
    const rootDir = path.resolve(dir);
    const isDryRun = opts.dryRun || false;

    console.log(
      chalk.blue(
        `\n🔧 ${isDryRun ? "[DRY RUN] " : ""}Replacing Chinese characters in: ${rootDir}\n`,
      ),
    );

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
      const result = await replaceProject(rootDir, options);

      if (result.summary.replaceable === 0) {
        console.log(chalk.green("✅ No replaceable Chinese characters found!"));
        return;
      }

      for (const fileResult of result.results) {
        const replaceable = fileResult.results.filter((r) => r.shouldReplace);
        if (replaceable.length === 0) continue;

        const relPath = path.relative(rootDir, fileResult.file);
        const status = fileResult.replaced
          ? chalk.green("✓ replaced")
          : chalk.yellow("⏳ dry run");
        console.log(
          `${status} ${chalk.cyan(relPath)} (${replaceable.length} change(s))`,
        );

        for (const r of replaceable) {
          console.log(
            `    L${r.line} "${chalk.red(r.original)}" → "${chalk.green(r.replacement)}"`,
          );
        }
      }

      console.log(chalk.blue("\n--- Summary ---"));
      console.log(
        `  Replaced: ${isDryRun ? chalk.yellow("(dry run) ") : ""}${result.summary.replaceable}`,
      );
      console.log(
        `  Kept: ${result.summary.totalFindings - result.summary.replaceable}`,
      );
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
