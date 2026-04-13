import { scanContent, replaceContent, parseStringSegments } from "./scanner";
import { ScanResult } from "./scanner";

console.log(
  "=== Test 1: Chinese punctuation in code context (should replace) ===",
);
{
  const code = `const arr = [1\uFF0C2\uFF0C3];`;
  const results = scanContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  const { content } = replaceContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Output:", content);
  console.log("Pass:", content === "const arr = [1,2,3];");
}

console.log(
  "\n=== Test 2: Chinese punctuation in Chinese string (should keep) ===",
);
{
  const code = `const msg = "\u4F60\u597D\uFF0C\u4E16\u754C\uFF01";`;
  const results = scanContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  const replaceable = results.filter((r: ScanResult) => r.shouldReplace);
  console.log("Replaceable count:", replaceable.length);
  console.log("Pass:", replaceable.length === 0);
}

console.log(
  "\n=== Test 3: Mixed context - code punctuation + Chinese string ===",
);
{
  const code = `const obj = {name\uFF1A "\u5F20\u4E09"\uFF0Cage\uFF1A 25};`;
  const { content } = replaceContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  console.log("Output:", content);
  console.log(
    "Pass:",
    content === 'const obj = {name: "\u5F20\u4E09",age: 25};',
  );
}

console.log("\n=== Test 4: Fullwidth characters in code ===");
{
  const code = `const x = \uFF11\uFF0B\uFF12\uFF1B`;
  const { content } = replaceContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  console.log("Output:", content);
  console.log("Pass:", content === "const x = 1+2;");
}

console.log("\n=== Test 5: Comment with Chinese (should keep) ===");
{
  const code = `// \u8FD9\u662F\u4E00\u4E2A\u6CE8\u91CA\uFF0C\u4FDD\u7559\u4E2D\u6587\u6807\u70B9`;
  const results = scanContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  const replaceable = results.filter((r: ScanResult) => r.shouldReplace);
  console.log("Replaceable count:", replaceable.length);
  console.log("Pass:", replaceable.length === 0);
}

console.log("\n=== Test 6: Chinese semicolon in code ===");
{
  const code = `const str = "hello" + "world"\uFF1B`;
  const { content } = replaceContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  console.log("Output:", content);
  console.log("Pass:", content === 'const str = "hello" + "world";');
}

console.log("\n=== Test 7: i18n key should be kept ===");
{
  const code = `const label = t("app.title");`;
  const results = scanContent(code, "test.js", {
    replacePunctuation: true,
    replaceFullwidth: true,
    replaceChineseChars: false,
    contextAware: true,
  });
  console.log("Input:", code);
  const replaceable = results.filter((r: ScanResult) => r.shouldReplace);
  console.log("Replaceable count:", replaceable.length);
  console.log("Pass:", replaceable.length === 0);
}

console.log("\n=== Test 8: String segment parsing ===");
{
  const line = `const a = "hello\uFF0Cworld"; const b = 'test';`;
  const segments = parseStringSegments(line);
  console.log("Input:", line);
  console.log("Segments:", JSON.stringify(segments, null, 2));
  const stringSeg = segments.find((s: any) => s.isString);
  console.log("Pass:", stringSeg && stringSeg.content === '"hello\uFF0Cworld"');
}

console.log("\n=== All tests completed! ===");
