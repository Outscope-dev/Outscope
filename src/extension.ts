import * as vscode from "vscode";
import { findSmartEscapeOffset } from "./smartEscape";
import type { SupportedLanguage } from "./ast";

const supportedLanguages = new Set<SupportedLanguage>([
  "javascript",
  "typescript",
]);

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerTextEditorCommand(
    "smartSyntaxEscape.escape",
    (editor) => runSmartSyntaxEscape(editor),
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}

function runSmartSyntaxEscape(editor: vscode.TextEditor): void {
  const languageId = editor.document.languageId;
  if (!supportedLanguages.has(languageId as SupportedLanguage)) {
    return;
  }

  // Moving a non-empty selection would silently discard user intent.
  if (editor.selections.some((selection) => !selection.isEmpty)) {
    return;
  }

  const sourceText = editor.document.getText();
  const language = languageId as SupportedLanguage;
  const nextSelections = editor.selections.map((selection) => {
    const cursorOffset = editor.document.offsetAt(selection.active);
    const target = findSmartEscapeOffset(sourceText, cursorOffset, language);

    if (target === null) {
      return selection;
    }

    const position = editor.document.positionAt(target);
    return new vscode.Selection(position, position);
  });

  editor.selections = nextSelections;
}
