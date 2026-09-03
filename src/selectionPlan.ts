import {
  findSmartEscapeOffsetInAnalysis,
  type SmartEscapeAnalysis,
} from "./smartEscape";

export type OffsetSelection = Readonly<{
  anchorOffset: number;
  activeOffset: number;
}>;

export function planSmartEscapeSelections(
  analysis: SmartEscapeAnalysis,
  selections: readonly OffsetSelection[],
): OffsetSelection[] {
  return selections.map((selection) => {
    if (selection.anchorOffset !== selection.activeOffset) {
      return selection;
    }

    const target = findSmartEscapeOffsetInAnalysis(
      analysis,
      selection.activeOffset,
    );
    if (target === null) {
      return selection;
    }

    return { anchorOffset: target, activeOffset: target };
  });
}
