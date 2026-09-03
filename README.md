# Smart Syntax Escape

Smart Syntax Escape is a small VS Code extension for JavaScript and TypeScript.
It moves each collapsed cursor across the longest safely escapable run of nested
closing syntax in one command.

For example, running **Smart Syntax Escape** here:

```ts
foo({
  bar: ["hello|"],
})
```

moves the cursor only as far as the remaining syntax permits. Commas,
semicolons, operators, comments, and other semantic content are never consumed.

## Run locally

1. Run `npm install`.
2. Run `npm test`.
3. Open this folder in VS Code and press `F5` to launch an Extension Development
   Host.
4. Open a `.js`, `.mjs`, `.cjs`, or `.ts` file, place the cursor before generated
   closing syntax, and run **Smart Syntax Escape** from the Command Palette.

The command ID is `smartSyntaxEscape.escape`. No default keybinding is installed;
assign one with VS Code's Keyboard Shortcuts editor if desired.

To build an installable VSIX, run `npm run package`.

## V1 limits

V1 intentionally supports only VS Code language IDs `javascript` and
`typescript`. JSX/TSX, HTML, CSS, Vue, Svelte, other languages, TypeScript generic
angle brackets, snippet navigation, Emmet, and Copilot integration are out of
scope. Non-empty selections are left unchanged. Parser-recovery cases are handled
conservatively, so uncertain targets produce no movement or a shorter movement.
