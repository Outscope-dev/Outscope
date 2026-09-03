import * as ts from "typescript";

export type SupportedLanguage = "javascript" | "typescript";

export function createSourceFile(
  sourceText: string,
  language: SupportedLanguage,
): ts.SourceFile {
  const fileName = language === "typescript" ? "document.ts" : "document.js";
  const scriptKind = language === "typescript" ? ts.ScriptKind.TS : ts.ScriptKind.JS;

  return ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
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
