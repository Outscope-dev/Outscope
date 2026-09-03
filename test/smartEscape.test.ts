import assert from "node:assert/strict";
import test from "node:test";
import { findSmartEscapeOffset } from "../src/smartEscape";
import type { SupportedLanguage } from "../src/ast";

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
