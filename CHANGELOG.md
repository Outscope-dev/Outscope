# Change Log

## 2.0.0

- Added JSX and TSX closing-boundary support, including expressions,
  self-closing elements, matching closing elements, and fragments.
- Replaced character-only transition checks with TypeScript Scanner token
  validation.
- Distinguished semantic whitespace inside strings, templates, and JSX text
  from ignorable JavaScript trivia.
- Added document URI/version/language analysis caching.
- Added independent mixed multi-cursor planning while preserving non-empty
  selections.
- Expanded malformed-source and regression coverage to 47 automated tests.

## 1.0.0

- Added AST-aware Smart Syntax Escape for JavaScript and TypeScript.
- Added conservative handling for nested expressions, templates, comments,
  semicolons, and incomplete source.
