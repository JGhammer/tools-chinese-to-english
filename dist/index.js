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
exports.replaceContent = exports.scanContent = void 0;
exports.scanProject = scanProject;
exports.replaceProject = replaceProject;
const fs = __importStar(require("fs"));
const glob_1 = __importDefault(require("glob"));
const util_1 = require("util");
const scanner_1 = require("./scanner");
Object.defineProperty(exports, "scanContent", { enumerable: true, get: function () { return scanner_1.scanContent; } });
Object.defineProperty(exports, "replaceContent", { enumerable: true, get: function () { return scanner_1.replaceContent; } });
const globAsync = (0, util_1.promisify)(glob_1.default);
async function globFiles(includePatterns, excludePatterns, rootDir) {
    const allFiles = new Set();
    for (const pattern of includePatterns) {
        try {
            const matches = (await globAsync(pattern, {
                cwd: rootDir,
                ignore: excludePatterns,
                absolute: true,
                nodir: true,
            }));
            for (const m of matches) {
                allFiles.add(m);
            }
        }
        catch (err) {
            // skip invalid patterns
        }
    }
    return Array.from(allFiles);
}
async function scanProject(rootDir, options = {}) {
    const includePatterns = options.include || scanner_1.DEFAULT_INCLUDE;
    const excludePatterns = options.exclude || scanner_1.DEFAULT_EXCLUDE;
    const files = await globFiles(includePatterns, excludePatterns, rootDir);
    const fileResults = [];
    let totalFindings = 0;
    let replaceable = 0;
    const byType = {};
    for (const file of files) {
        try {
            const content = fs.readFileSync(file, "utf-8");
            const results = (0, scanner_1.scanContent)(content, file, {
                ...options,
                contextAware: options.contextAware !== false,
            });
            if (results.length > 0) {
                fileResults.push({ file, results, replaced: false });
                totalFindings += results.length;
                for (const r of results) {
                    if (r.shouldReplace)
                        replaceable++;
                    byType[r.type] = (byType[r.type] || 0) + 1;
                }
            }
        }
        catch (err) {
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
async function replaceProject(rootDir, options = {}) {
    const includePatterns = options.include || scanner_1.DEFAULT_INCLUDE;
    const excludePatterns = options.exclude || scanner_1.DEFAULT_EXCLUDE;
    const files = await globFiles(includePatterns, excludePatterns, rootDir);
    const fileResults = [];
    let totalFindings = 0;
    let replaceable = 0;
    const byType = {};
    for (const file of files) {
        try {
            const content = fs.readFileSync(file, "utf-8");
            const { content: newContent, results } = (0, scanner_1.replaceContent)(content, file, {
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
                    if (r.shouldReplace)
                        replaceable++;
                    byType[r.type] = (byType[r.type] || 0) + 1;
                }
            }
        }
        catch (err) {
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
//# sourceMappingURL=index.js.map