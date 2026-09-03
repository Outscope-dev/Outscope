import type { SupportedLanguage } from "./ast";
import {
  createSmartEscapeAnalysis,
  type SmartEscapeAnalysis,
} from "./smartEscape";

type CacheEntry = {
  version: number;
  language: SupportedLanguage;
  analysis: SmartEscapeAnalysis;
};

export class SmartEscapeAnalysisCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(
    key: string,
    version: number,
    language: SupportedLanguage,
    readSourceText: () => string,
  ): SmartEscapeAnalysis {
    const cached = this.entries.get(key);
    if (
      cached !== undefined &&
      cached.version === version &&
      cached.language === language
    ) {
      return cached.analysis;
    }

    const analysis = createSmartEscapeAnalysis(readSourceText(), language);
    this.entries.set(key, { version, language, analysis });
    return analysis;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
