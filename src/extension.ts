import * as vscode from "vscode";
import { SmartEscapeAnalysisCache } from "./analysisCache";
import { planSmartEscapeSelections } from "./selectionPlan";
import type { SupportedLanguage } from "./ast";

const supportedLanguages = new Set<SupportedLanguage>([
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
]);

const analysisCache = new SmartEscapeAnalysisCache();

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerTextEditorCommand(
    "smartSyntaxEscape.escape",
    (editor) => runSmartSyntaxEscape(editor),
  );

  context.subscriptions.push(
    disposable,
    vscode.workspace.onDidCloseTextDocument((document) => {
      analysisCache.delete(document.uri.toString());
    }),
  );
}

export function deactivate(): void {
  analysisCache.clear();
}

function runSmartSyntaxEscape(editor: vscode.TextEditor): void {
  const languageId = editor.document.languageId;
  if (!supportedLanguages.has(languageId as SupportedLanguage)) {
    return;
  }

  const language = languageId as SupportedLanguage;
  const key = editor.document.uri.toString();
  const analysis = analysisCache.get(
    key,
    editor.document.version,
    language,
    () => editor.document.getText(),
  );
  const offsetSelections = editor.selections.map((selection) => ({
    anchorOffset: editor.document.offsetAt(selection.anchor),
    activeOffset: editor.document.offsetAt(selection.active),
  }));
  const plannedSelections = planSmartEscapeSelections(
    analysis,
    offsetSelections,
  );

  editor.selections = plannedSelections.map((selection) => {
    const anchor = editor.document.positionAt(selection.anchorOffset);
    const active = editor.document.positionAt(selection.activeOffset);
    return new vscode.Selection(anchor, active);
  });
}
