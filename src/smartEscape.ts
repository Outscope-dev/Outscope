import * as ts from "typescript";
import {
  createSourceFile,
  findNodePathAtOffset,
  SupportedLanguage,
} from "./ast";

type ClosingContext = {
  closingCharacter: ")" | "]" | "}" | "\"" | "'" | "`";
  boundary: number | null;
};

const closingOnlyPattern = /^[\s\)\]\}"'`]*$/u;

/**
 * Finds the furthest conservative closing-syntax boundary reachable from a
 * cursor. It never consumes commas, semicolons, operators, comments, or text.
 */
export function findSmartEscapeOffset(
  sourceText: string,
  cursorOffset: number,
  language: SupportedLanguage,
): number | null {
  if (cursorOffset < 0 || cursorOffset > sourceText.length) {
    return null;
  }

  const sourceFile = createSourceFile(sourceText, language);
  const path = findNodePathAtOffset(sourceFile, cursorOffset);
  let target = cursorOffset;
  let foundCandidate = false;

  for (let index = path.length - 1; index >= 0; index -= 1) {
    const node = path[index];
    const context = getClosingContext(node, sourceText, sourceFile);

    if (context === null) {
      continue;
    }

    // A syntactic container with a missing/recovered closer is a hard barrier.
    if (context.boundary === null) {
      break;
    }

    if (context.boundary < target) {
      continue;
    }

    const interveningText = sourceText.slice(target, context.boundary);
    if (!closingOnlyPattern.test(interveningText)) {
      break;
    }

    target = context.boundary;
    foundCandidate = target > cursorOffset;
  }

  return foundCandidate ? target : null;
}

function getClosingContext(
  node: ts.Node,
  sourceText: string,
  sourceFile: ts.SourceFile,
): ClosingContext | null {
  if (ts.isStringLiteral(node)) {
    const start = node.getStart(sourceFile);
    const quote = sourceText[start];
    if (quote !== "\"" && quote !== "'") {
      return null;
    }
    return contextEndingWith(node, sourceText, quote);
  }

  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
    return contextEndingWith(node, sourceText, "`");
  }

  if (
    ts.isCallExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return contextEndingWith(node, sourceText, ")");
  }

  if (ts.isArrayLiteralExpression(node) || ts.isElementAccessExpression(node)) {
    return contextEndingWith(node, sourceText, "]");
  }

  if (ts.isObjectLiteralExpression(node)) {
    return contextEndingWith(node, sourceText, "}");
  }

  return null;
}

function contextEndingWith(
  node: ts.Node,
  sourceText: string,
  closingCharacter: ClosingContext["closingCharacter"],
): ClosingContext {
  const hasRealClosingToken =
    node.end > node.getFullStart() && sourceText[node.end - 1] === closingCharacter;

  return {
    closingCharacter,
    boundary: hasRealClosingToken ? node.end : null,
  };
}
