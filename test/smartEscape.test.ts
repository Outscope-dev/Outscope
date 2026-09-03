import assert from "node:assert/strict";
import test from "node:test";
import {
  createSmartEscapeAnalysis,
  findSmartEscapeOffset,
  findSmartEscapeOffsetInAnalysis,
} from "../src/smartEscape";
import type { SupportedLanguage } from "../src/ast";
import { SmartEscapeAnalysisCache } from "../src/analysisCache";
import { planSmartEscapeSelections } from "../src/selectionPlan";

function splitMarker(marked: string): { text: string; offset: number } {
  const offset = marked.indexOf("|");
  assert.notEqual(offset, -1, `Missing cursor marker in: ${marked}`);
  assert.equal(marked.indexOf("|", offset + 1), -1, "Expected one cursor marker");
  return { text: marked.slice(0, offset) + marked.slice(offset + 1), offset };
}

function expectEscape(
  before: string,
  after: string,
  language: SupportedLanguage = "typescript",
): void {
  const input = splitMarker(before);
  const expected = splitMarker(after);
  assert.equal(input.text, expected.text, "Before/after text must be identical");
  assert.equal(
    findSmartEscapeOffset(input.text, input.offset, language),
    expected.offset,
  );
}

function expectNoEscape(
  source: string,
  language: SupportedLanguage = "typescript",
): void {
  const input = splitMarker(source);
  assert.equal(findSmartEscapeOffset(input.text, input.offset, language), null);
}

test("escapes a string and its containing call", () => {
  expectEscape(`foo("hello|")`, `foo("hello")|`);
});

test("escapes nested arrays, objects, calls, and whitespace", () => {
  expectEscape(
    `foo({\n  bar: [\n    "hello|"\n  ]\n})`,
    `foo({\n  bar: [\n    "hello"\n  ]\n})|`,
  );
});

test("escapes deeply nested calls", () => {
  expectEscape(`foo(bar(baz("hello|")))`, `foo(bar(baz("hello")))|`);
});

test("stops before a semicolon", () => {
  expectEscape(
    `const result = foo(["hello|"]);`,
    `const result = foo(["hello"])|;`,
  );
});

test("stops at a binary expression", () => {
  expectEscape(`foo("hello|" + world)`, `foo("hello"| + world)`);
});

test("stops before another function argument", () => {
  expectEscape(
    `foo(bar("hello|"), baz)`,
    `foo(bar("hello")|, baz)`,
  );
});

test("stops before another array element", () => {
  expectEscape(
    `foo([\n  "hello|",\n  "world"\n])`,
    `foo([\n  "hello"|,\n  "world"\n])`,
  );
});

test("escapes an object initializer without inventing statement ending", () => {
  expectEscape(
    `const data = {\n  foo: {\n    bar: [\n      baz("hello|")\n    ]\n  }\n}`,
    `const data = {\n  foo: {\n    bar: [\n      baz("hello")\n    ]\n  }\n}|`,
  );
});

test("escapes a completed template interpolation and template", () => {
  expectEscape(
    "const value = `hello ${foo(\"world|\")}`;",
    "const value = `hello ${foo(\"world\")}`|;",
  );
});

test("does not cross remaining template content", () => {
  expectEscape(
    "const value = `hello ${foo(\"world|\")} test`;",
    "const value = `hello ${foo(\"world\")|} test`;",
  );
});

test("escapes grouped expressions", () => {
  expectEscape(
    `const result = (((foo("bar|"))))`,
    `const result = (((foo("bar"))))|`,
  );
});

test("comments conservatively stop outer traversal", () => {
  expectEscape(
    `foo([\n  "hello|" // comment\n])`,
    `foo([\n  "hello"| // comment\n])`,
  );
});

test("incomplete containers are barriers", () => {
  expectEscape(
    `foo({\n  bar: [\n    baz("hello|")`,
    `foo({\n  bar: [\n    baz("hello")|`,
  );
});

test("does not move inside semantic string content", () => {
  expectNoEscape(`foo("hel|lo")`);
});

test("does not move at an unrelated arbitrary location", () => {
  expectNoEscape(`const |answer = foo("hello")`);
});

test("supports JavaScript parsing", () => {
  expectEscape(`foo(['hello|'])`, `foo(['hello'])|`, "javascript");
});

test("rejects invalid cursor offsets", () => {
  assert.equal(findSmartEscapeOffset("foo()", -1, "typescript"), null);
  assert.equal(findSmartEscapeOffset("foo()", 6, "typescript"), null);
});

test("treats whitespace remaining inside a string as semantic content", () => {
  expectNoEscape(`foo("hello|  ")`);
});

test("allows whitespace outside a string before closing containers", () => {
  expectEscape(`foo(["hello"|  \n ])`, `foo(["hello"  \n ])|`);
});

test("treats whitespace remaining in a raw template as content", () => {
  expectNoEscape("const value = `hello|  `");
});

test("allows JavaScript whitespace before a template interpolation closer", () => {
  expectEscape(
    "const value = `hello ${foo(\"world|\")   }`;",
    "const value = `hello ${foo(\"world\")   }`|;",
  );
});

test("allows Unicode JavaScript whitespace before a template closer", () => {
  expectEscape(
    "const value = `hello ${foo(\"world|\")\u00a0}`;",
    "const value = `hello ${foo(\"world\")\u00a0}`|;",
  );
});

test("does not cross whitespace that belongs to the template tail", () => {
  expectEscape(
    "const value = `hello ${foo(\"world|\")} `;",
    "const value = `hello ${foo(\"world\")|} `;",
  );
});

test("block comments are barriers", () => {
  expectEscape(
    `foo(["hello|" /* keep */])`,
    `foo(["hello"| /* keep */])`,
  );
});

test("supports element access boundaries", () => {
  expectEscape(`foo[bar["key|"]]`, `foo[bar["key"]]|`);
});

test("supports optional call boundaries", () => {
  expectEscape(`foo?.(bar("value|"))`, `foo?.(bar("value"))|`);
});

test("supports new-expression boundaries", () => {
  expectEscape(`consume(new Box("value|"))`, `consume(new Box("value"))|`);
});

test("a missing outer call closer stops at the last complete context", () => {
  expectEscape(`foo(bar("value|")`, `foo(bar("value")|`);
});

test("does not treat TypeScript generic angle brackets as escape targets", () => {
  expectNoEscape(`const value = factory<Result|>();`);
});

test("supports a TSX self-closing tag after an expression attribute", () => {
  expectEscape(
    `<Component value={foo("hello|")} />`,
    `<Component value={foo("hello")} />|`,
    "typescriptreact",
  );
});

test("supports a JSX quoted attribute and self-closing tag", () => {
  expectEscape(
    `<Component label="hello|" />`,
    `<Component label="hello" />|`,
    "javascriptreact",
  );
});

test("escapes an immediately closed JSX element", () => {
  expectEscape(
    `<Box value={foo("hello|")}></Box>`,
    `<Box value={foo("hello")}></Box>|`,
    "typescriptreact",
  );
});

test("stops after a JSX opening tag when child content remains", () => {
  expectEscape(
    `<Box value={foo("hello|")}>text</Box>`,
    `<Box value={foo("hello")}>|text</Box>`,
    "typescriptreact",
  );
});

test("JSX text whitespace prevents crossing a closing tag", () => {
  expectEscape(
    `<Box>{foo("hello|")} \n</Box>`,
    `<Box>{foo("hello")}| \n</Box>`,
    "typescriptreact",
  );
});

test("escapes an immediately closing JSX fragment", () => {
  expectEscape(
    `<><Box value="hello|" /></>`,
    `<><Box value="hello" /></>|`,
    "typescriptreact",
  );
});

test("escapes nested JSX closing syntax", () => {
  expectEscape(
    `<Outer><Inner value="hello|" /></Outer>`,
    `<Outer><Inner value="hello" /></Outer>|`,
    "typescriptreact",
  );
});

test("does not cross a mismatched JSX closing tag", () => {
  expectEscape(
    `<Alpha value="hello|"></Beta>`,
    `<Alpha value="hello">|</Beta>`,
    "typescriptreact",
  );
});

test("stops at the opening tag when a JSX closing tag is missing", () => {
  expectEscape(
    `<Alpha value="hello|">`,
    `<Alpha value="hello">|`,
    "typescriptreact",
  );
});

test("comments inside a JSX expression remain barriers", () => {
  expectEscape(
    `<Box value={foo("hello|") /* keep */} />`,
    `<Box value={foo("hello")| /* keep */} />`,
    "typescriptreact",
  );
});

test("supports CRLF formatting between closing tokens", () => {
  expectEscape(
    `foo({\r\n  value: ["hello|"\r\n  ]\r\n})`,
    `foo({\r\n  value: ["hello"\r\n  ]\r\n})|`,
  );
});

test("supports Unicode content without offset drift", () => {
  expectEscape(`foo(["안녕 🌏|"])`, `foo(["안녕 🌏"])|`);
});

test("can escape from trivia immediately before a closer", () => {
  expectEscape(`foo(bar() |)`, `foo(bar() )|`);
});

test("reuses a prepared analysis for multiple cursor calculations", () => {
  const first = splitMarker(`foo("one|")`);
  const secondMarked = `foo("one")\nbar(["two|"])`;
  const second = splitMarker(secondMarked);
  const analysis = createSmartEscapeAnalysis(second.text, "typescript");

  assert.equal(
    findSmartEscapeOffsetInAnalysis(analysis, first.offset),
    first.text.length,
  );
  assert.equal(
    findSmartEscapeOffsetInAnalysis(analysis, second.offset),
    second.text.length,
  );
});

test("all returned offsets are monotonic and inside the document", () => {
  const sources = [
    `foo(["hello"])`,
    `const value = \`hello \${foo("world")}\`;`,
    `<Box value={foo("hello")} />`,
  ];
  const languages: SupportedLanguage[] = [
    "typescript",
    "typescript",
    "typescriptreact",
  ];

  sources.forEach((source, sourceIndex) => {
    for (let offset = 0; offset <= source.length; offset += 1) {
      const target = findSmartEscapeOffset(source, offset, languages[sourceIndex]);
      if (target !== null) {
        assert.ok(target > offset);
        assert.ok(target <= source.length);
      }
    }
  });
});

test("analysis cache reuses a document version without reading text again", () => {
  const cache = new SmartEscapeAnalysisCache();
  let reads = 0;
  const read = (): string => {
    reads += 1;
    return `foo("hello")`;
  };

  const first = cache.get("file:///test.ts", 1, "typescript", read);
  const second = cache.get("file:///test.ts", 1, "typescript", read);
  const third = cache.get("file:///test.ts", 2, "typescript", read);

  assert.equal(first, second);
  assert.notEqual(second, third);
  assert.equal(reads, 2);
});

test("analysis cache invalidates when the language changes", () => {
  const cache = new SmartEscapeAnalysisCache();
  const first = cache.get("file:///component", 1, "typescript", () => "foo()");
  const second = cache.get(
    "file:///component",
    1,
    "typescriptreact",
    () => "<Box />",
  );

  assert.notEqual(first, second);
  assert.equal(second.language, "typescriptreact");
});

test("multi-cursor planning moves collapsed cursors independently", () => {
  const source = `foo("one")\nbar(["two"])\nconst keep = 1`;
  const analysis = createSmartEscapeAnalysis(source, "typescript");
  const firstCursor = source.indexOf('"one"') + 4;
  const secondCursor = source.indexOf('"two"') + 4;
  const firstTarget = source.indexOf(")") + 1;
  const secondTarget = source.lastIndexOf(")") + 1;
  const nonEmptySelection = { anchorOffset: 28, activeOffset: 32 };

  assert.deepEqual(
    planSmartEscapeSelections(analysis, [
      { anchorOffset: firstCursor, activeOffset: firstCursor },
      { anchorOffset: secondCursor, activeOffset: secondCursor },
      nonEmptySelection,
    ]),
    [
      { anchorOffset: firstTarget, activeOffset: firstTarget },
      { anchorOffset: secondTarget, activeOffset: secondTarget },
      nonEmptySelection,
    ],
  );
});
