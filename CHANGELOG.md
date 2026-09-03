# Change Log

## 2.0.3

- Added the Outscope marketplace logo to the extension package metadata.

## 2.0.2

- Renamed the extension package and display name to **Outscope**.
- Moved the command to the `outscope.escape` namespace and categorized it as
  **Outscope: Smart Syntax Escape** in the Command Palette.

## 2.0.1

- Added `Alt+Enter` as the default Smart Syntax Escape keybinding in supported
  JavaScript, TypeScript, JSX, and TSX editors.

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
