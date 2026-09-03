# Smart Syntax Escape

Smart Syntax Escape is a VS Code extension for JavaScript, TypeScript, JSX, and
TSX. It moves each collapsed cursor across the longest safely escapable run of
nested closing syntax in one command.

For example, running **Smart Syntax Escape** here:

```ts
foo({
  bar: ["hello|"],
})
```

moves the cursor only as far as the remaining syntax permits. Commas,
semicolons, operators, comments, and other semantic content are never consumed.

V2 also understands JSX/TSX boundaries:

```tsx
<Panel value={format("hello|")} />
```

becomes:

```tsx
<Panel value={format("hello")} />|
```

The closing `}`, `>`, `/>`, and matching JSX closing tags are recognized only
inside their corresponding TypeScript AST contexts. Generic angle brackets are
not escape targets.

## Safety model

- TypeScript's parser identifies the exact ancestor contexts around the cursor.
- TypeScript's scanner verifies that transitions contain only whitespace trivia
  and the expected closing tokens.
- Whitespace inside strings, raw template text, and JSX text remains semantic
  content and is never skipped.
- Comments, punctuation, operators, and remaining arguments/elements stop the
  traversal.
- Missing or mismatched parser-recovered closers are hard barriers.
- Parsed documents are cached by URI, language, and document version.
- Collapsed multi-cursors move independently; non-empty selections are preserved.

## Run locally

1. Run `npm install`.
2. Run `npm test`.
3. Open this folder in VS Code and press `F5` to launch an Extension Development
   Host.
4. Open a `.js`, `.mjs`, `.cjs`, `.ts`, `.jsx`, or `.tsx` file, place the cursor
   before generated closing syntax, and run **Smart Syntax Escape** from the
   Command Palette.

The command ID is `smartSyntaxEscape.escape`. Press `Alt+Enter` in a supported
editor or run **Smart Syntax Escape** from the Command Palette.

To build an installable VSIX, run `npm run package`.

## V2 limits

V2 supports the VS Code language IDs `javascript`, `javascriptreact`,
`typescript`, and `typescriptreact`. HTML, CSS, Vue, Svelte, other languages,
TypeScript generic angle brackets, snippet navigation, Emmet, and Copilot
integration remain out of scope. Parser-recovery cases are handled
conservatively, so uncertain targets produce no movement or a shorter movement.
