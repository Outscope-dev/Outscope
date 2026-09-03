import * as ts from "typescript";

export type SupportedLanguage =
  | "javascript"
  | "javascriptreact"
  | "typescript"
  | "typescriptreact";

export function createSourceFile(
  sourceText: string,
  language: SupportedLanguage,
): ts.SourceFile {
  const fileNameByLanguage: Record<SupportedLanguage, string> = {
    javascript: "document.js",
    javascriptreact: "document.jsx",
    typescript: "document.ts",
    typescriptreact: "document.tsx",
  };
  const scriptKindByLanguage: Record<SupportedLanguage, ts.ScriptKind> = {
    javascript: ts.ScriptKind.JS,
    javascriptreact: ts.ScriptKind.JSX,
    typescript: ts.ScriptKind.TS,
    typescriptreact: ts.ScriptKind.TSX,
  };

  return ts.createSourceFile(
    fileNameByLanguage[language],
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindByLanguage[language],
  );
}

export function getLanguageVariant(
  language: SupportedLanguage,
): ts.LanguageVariant {
  return language === "javascriptreact" || language === "typescriptreact"
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard;
}

/** Returns nodes from the SourceFile down to the smallest node at offset. */
export function findNodePathAtOffset(
  sourceFile: ts.SourceFile,
  offset: number,
): ts.Node[] {
  const path: ts.Node[] = [];

  const visit = (node: ts.Node): void => {
    if (offset < node.getFullStart() || offset > node.end) {
      return;
    }

    path.push(node);

    let containingChild: ts.Node | undefined;
    node.forEachChild((child) => {
      if (
        containingChild === undefined &&
        child.getFullStart() <= offset &&
        offset <= child.end
      ) {
        containingChild = child;
      }
    });

    if (containingChild !== undefined) {
      visit(containingChild);
    }
  };

  visit(sourceFile);
  return path;
}
