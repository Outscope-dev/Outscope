import * as ts from "typescript";
import {
  createSourceFile,
  findNodePathAtOffset,
  getLanguageVariant,
  SupportedLanguage,
} from "./ast";

export type SmartEscapeAnalysis = Readonly<{
  sourceText: string;
  language: SupportedLanguage;
  sourceFile: ts.SourceFile;
}>;

type TokenClosingContext = {
  kind: "tokens";
  boundary: number | null;
  expectedTokens: readonly ts.SyntaxKind[];
};

type QuotedClosingContext = {
  kind: "quoted";
  boundary: number | null;
  closingOffset: number;
};

type TemplateClosingContext = {
  kind: "template";
  boundary: number | null;
  finalExpressionEnd: number;
};

type AtomicClosingContext = {
  kind: "atomic";
  boundary: number | null;
  start: number;
};

type ClosingContext =
  | TokenClosingContext
  | QuotedClosingContext
  | TemplateClosingContext
  | AtomicClosingContext;

export function createSmartEscapeAnalysis(
  sourceText: string,
  language: SupportedLanguage,
): SmartEscapeAnalysis {
  return {
    sourceText,
    language,
    sourceFile: createSourceFile(sourceText, language),
  };
}

/** Convenience API for callers that do not reuse the parsed SourceFile. */
export function findSmartEscapeOffset(
  sourceText: string,
  cursorOffset: number,
  language: SupportedLanguage,
): number | null {
  return findSmartEscapeOffsetInAnalysis(
    createSmartEscapeAnalysis(sourceText, language),
    cursorOffset,
  );
}

/**
 * Finds the furthest conservative AST closing boundary reachable from a cursor.
 * The document is never edited and semantic tokens are never consumed.
 */
export function findSmartEscapeOffsetInAnalysis(
  analysis: SmartEscapeAnalysis,
  cursorOffset: number,
): number | null {
  const { sourceText, sourceFile, language } = analysis;
  if (cursorOffset < 0 || cursorOffset > sourceText.length) {
    return null;
  }

  const path = findNodePathAtOffset(sourceFile, cursorOffset);
  let target = cursorOffset;
  let foundCandidate = false;

  for (let index = path.length - 1; index >= 0; index -= 1) {
    const context = getClosingContext(path[index], sourceText, sourceFile);
    if (context === null) {
      continue;
    }

    // A parser-recovered container without its real closer is a hard barrier.
    if (context.boundary === null) {
      break;
    }

    // At a node's existing boundary, keep climbing instead of treating its
    // already-consumed closer as a failed transition.
    if (context.boundary <= target) {
      continue;
    }

    if (!isSafeTransition(sourceText, target, context, language)) {
      break;
    }

    target = context.boundary;
    foundCandidate ||= target > cursorOffset;
  }

  return foundCandidate ? target : null;
}

function getClosingContext(
  node: ts.Node,
  sourceText: string,
  sourceFile: ts.SourceFile,
): ClosingContext | null {
  if (ts.isStringLiteral(node)) {
    const quote = sourceText[node.getStart(sourceFile)];
    if (quote !== "\"" && quote !== "'") {
      return null;
    }
    return quotedContext(node, sourceText, quote);
  }

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return quotedContext(node, sourceText, "`");
  }

  if (ts.isTemplateExpression(node)) {
    const finalSpan = node.templateSpans[node.templateSpans.length - 1];
    return {
      kind: "template",
      boundary: endsWith(node, sourceText, "`") ? node.end : null,
      finalExpressionEnd: finalSpan?.expression.end ?? node.end,
    };
  }

  if (
    ts.isCallExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return tokenContext(node, sourceText, ")", [ts.SyntaxKind.CloseParenToken]);
  }

  if (ts.isArrayLiteralExpression(node) || ts.isElementAccessExpression(node)) {
    return tokenContext(node, sourceText, "]", [ts.SyntaxKind.CloseBracketToken]);
  }

  if (ts.isObjectLiteralExpression(node) || ts.isJsxExpression(node)) {
    return tokenContext(node, sourceText, "}", [ts.SyntaxKind.CloseBraceToken]);
  }

  if (ts.isJsxOpeningElement(node)) {
    return tokenContext(node, sourceText, ">", [ts.SyntaxKind.GreaterThanToken]);
  }

  if (ts.isJsxSelfClosingElement(node)) {
    return tokenContext(node, sourceText, "/>", [
      ts.SyntaxKind.SlashToken,
      ts.SyntaxKind.GreaterThanToken,
    ]);
  }

  if (ts.isJsxElement(node)) {
    const openingName = node.openingElement.tagName.getText(sourceFile);
    const closingName = node.closingElement.tagName.getText(sourceFile);
    const closingStart = node.closingElement.getStart(sourceFile);
    const closingText = sourceText.slice(closingStart, node.end);
    const hasMatchingClosingElement =
      openingName === closingName &&
      closingText.startsWith("</") &&
      closingText.endsWith(">");
    return {
      kind: "atomic",
      start: closingStart,
      boundary: hasMatchingClosingElement ? node.end : null,
    };
  }

  if (ts.isJsxFragment(node)) {
    const closingStart = node.closingFragment.getStart(sourceFile);
    return {
      kind: "atomic",
      start: closingStart,
      boundary:
        sourceText.slice(closingStart, node.end) === "</>" ? node.end : null,
    };
  }

  return null;
}

function tokenContext(
  node: ts.Node,
  sourceText: string,
  suffix: string,
  expectedTokens: readonly ts.SyntaxKind[],
): TokenClosingContext {
  return {
    kind: "tokens",
    boundary: endsWith(node, sourceText, suffix) ? node.end : null,
    expectedTokens,
  };
}

function quotedContext(
  node: ts.Node,
  sourceText: string,
  quote: "\"" | "'" | "`",
): QuotedClosingContext {
  const hasClosingQuote = endsWith(node, sourceText, quote);
  return {
    kind: "quoted",
    boundary: hasClosingQuote ? node.end : null,
    closingOffset: node.end - 1,
  };
}

function endsWith(node: ts.Node, sourceText: string, suffix: string): boolean {
  return (
    node.end >= suffix.length &&
    sourceText.slice(node.end - suffix.length, node.end) === suffix
  );
}

function isSafeTransition(
  sourceText: string,
  target: number,
  context: ClosingContext,
  language: SupportedLanguage,
): boolean {
  switch (context.kind) {
    case "quoted":
      // Whitespace inside strings/templates is semantic content.
      return target === context.closingOffset;

    case "tokens":
      return matchesWhitespaceAndTokens(
        sourceText,
        target,
        context.boundary ?? target,
        context.expectedTokens,
        language,
      );

    case "template": {
      if (target > context.finalExpressionEnd || context.boundary === null) {
        return false;
      }
      const tail = sourceText.slice(context.finalExpressionEnd, context.boundary);
      if (!tail.endsWith("}`")) {
        return false;
      }
      return matchesWhitespaceAndTokens(
        sourceText,
        target,
        context.boundary - 2,
        [],
        language,
      );
    }

    case "atomic":
      // Whitespace before a JSX closing tag is JSX text and may be rendered.
      return target === context.start;
  }
}

function matchesWhitespaceAndTokens(
  sourceText: string,
  start: number,
  end: number,
  expectedTokens: readonly ts.SyntaxKind[],
  language: SupportedLanguage,
): boolean {
  if (start > end) {
    return false;
  }

  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    getLanguageVariant(language),
    sourceText,
    undefined,
    start,
    end - start,
  );
  const actualTokens: ts.SyntaxKind[] = [];

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.WhitespaceTrivia ||
      token === ts.SyntaxKind.NewLineTrivia
    ) {
      continue;
    }
    actualTokens.push(token);
  }

  return (
    actualTokens.length === expectedTokens.length &&
    actualTokens.every((token, index) => token === expectedTokens[index])
  );
}
