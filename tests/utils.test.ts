import { describe, expect, it } from "vitest";

import { PRESET_NAMES, resolveProjectFormat } from "@/lib/formats/registry";
import { countWords } from "@/lib/utils";

describe("Utils", () => {
  it("countWords calculates words properly", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords("Hello world from unit test")).toBe(5);
    expect(countWords("Multiple   spaces    and\nnewlines")).toBe(4);
  });
});

describe("Format Registry", () => {
  it("resolves IEEE preset format", () => {
    const config = resolveProjectFormat("IEEE");
    expect(config.id).toBe("ieee");
    expect(config.name).toBe("IEEE");
    expect(config.page.columns).toBe(2);
  });

  it("has valid preset names", () => {
    expect(PRESET_NAMES).toContain("IEEE");
    expect(PRESET_NAMES).toContain("Springer");
    expect(PRESET_NAMES).toContain("Elsevier");
  });
});
