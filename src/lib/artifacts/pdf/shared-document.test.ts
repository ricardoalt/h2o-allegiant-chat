import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bannerTone, h2oBrand, severityBg, themeAccentByIndex, themePalette } from "./brand-tokens";
import { resolveH2oPdfLogoSource, stageBadgeColor } from "./shared-document";

describe("resolveH2oPdfLogoSource", () => {
  it("resolves the sidebar logo asset from public for server-side PDF rendering", () => {
    const expectedPath = join(process.cwd(), "public", "h2o-allegiant.png");

    expect(existsSync(expectedPath)).toBe(true);
    expect(resolveH2oPdfLogoSource()).toBe(expectedPath);
  });

  it("returns null for missing assets so renderers can use the fallback mark", () => {
    const missingPath = join(process.cwd(), "public", "missing-h2o-logo.png");

    expect(resolveH2oPdfLogoSource(missingPath)).toBeNull();
  });
});

describe("stageBadgeColor", () => {
  it.each([
    ["Lead", h2oBrand.colors.stage.lead],
    ["Qualify", h2oBrand.colors.stage.qualify],
    ["Scope", h2oBrand.colors.stage.scope],
    ["Position", h2oBrand.colors.stage.position],
    ["Propose", h2oBrand.colors.stage.propose],
    ["Close", h2oBrand.colors.stage.close],
  ])("maps %s to its semantic stage color", (stage, color) => {
    expect(stageBadgeColor(stage)).toBe(color);
  });

  it("uses the muted fallback for unknown stages", () => {
    expect(stageBadgeColor("Unknown")).toBe(h2oBrand.colors.stage.default);
  });
});

// ─── RED: brand-tokens additions ──────────────────────────────────────────────

describe("severityBg", () => {
  it("stop is the verbatim hex from brand.py STOP tint (#FBE7E7)", () => {
    expect(severityBg.stop).toBe("#FBE7E7");
  });

  it("specialist is the verbatim hex from brand.py SPECIALIST tint (#FDF2E1)", () => {
    expect(severityBg.specialist).toBe("#FDF2E1");
  });

  it("attention is the verbatim hex from brand.py ATTENTION tint (#FDF7E1)", () => {
    expect(severityBg.attention).toBe("#FDF7E1");
  });

  it("clear is the LIGHT_BG_GREY from brand.py (#F8FAFC)", () => {
    expect(severityBg.clear).toBe("#F8FAFC");
  });

  it("openGreen is the OPEN gate tint from brand.py (#E8F5EC)", () => {
    expect(severityBg.openGreen).toBe("#E8F5EC");
  });
});

describe("bannerTone", () => {
  it("red.bg matches brand.py GATE_CLOSED / FLAG_STOP red (#B91C1C)", () => {
    expect(bannerTone.red.bg).toBe("#B91C1C");
  });

  it("red.text is white (#FFFFFF)", () => {
    expect(bannerTone.red.text).toBe("#FFFFFF");
  });

  it("amber.bg matches brand.py GATE_CONDITIONAL (#D97706)", () => {
    expect(bannerTone.amber.bg).toBe("#D97706");
  });

  it("navy.bg matches brand.py BRAND_NAVY (#03045E)", () => {
    expect(bannerTone.navy.bg).toBe("#03045E");
  });
});

describe("themeAccentByIndex", () => {
  it("returns the first palette entry for index 0", () => {
    expect(themeAccentByIndex(0)).toBe(themePalette[0]);
  });

  it("returns the correct entry for mid-range indices", () => {
    expect(themeAccentByIndex(3)).toBe(themePalette[3]);
    expect(themeAccentByIndex(6)).toBe(themePalette[6]);
  });

  it("wraps back to palette start when index equals palette length", () => {
    expect(themeAccentByIndex(themePalette.length)).toBe(themePalette[0]);
  });

  it("wraps correctly for index well past palette length", () => {
    expect(themeAccentByIndex(themePalette.length + 2)).toBe(themePalette[2]);
  });

  it("handles negative index by wrapping (mod semantics)", () => {
    // negative wrap: -1 → last element
    const last =
      themePalette[((-1 % themePalette.length) + themePalette.length) % themePalette.length];
    expect(themeAccentByIndex(-1)).toBe(last);
  });
});

// ─── RED: shared-document new primitives (smoke renders) ──────────────────────

import { Document, Page, Text as PdfText, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import {
  DataTable,
  EvidenceAnchorInline,
  FlagListItem,
  Footer,
  FullWidthBanner,
  KVTable,
  MinimalContinuationHeader,
  MinimalHeader,
  SectionHeading,
  SeverityToken,
  StatusBanner,
  WhyItMattersCallout,
} from "./shared-document";

const renderDoc = async (component: React.ReactElement): Promise<Buffer> => {
  const doc = createElement(Document, null, createElement(Page, { size: "LETTER" }, component));
  return renderToBuffer(doc);
};

describe("MinimalHeader (smoke render)", () => {
  it("renders a valid PDF prefix when all required props are provided", async () => {
    const pdf = await renderDoc(
      createElement(MinimalHeader, {
        customerName: "Prairie Water",
        county: "Prairie County",
        state: "TX",
        date: "2026-05-19",
        artifactLabel: "Playbook",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders without error when optional basin is omitted", async () => {
    const pdf = await renderDoc(
      createElement(MinimalHeader, {
        customerName: "Prairie Water",
        county: "Prairie County",
        state: "TX",
        date: "2026-05-19",
        artifactLabel: "Analytical Read",
      }),
    );
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});

describe("MinimalContinuationHeader (smoke render)", () => {
  it("renders a valid PDF prefix", async () => {
    const pdf = await renderDoc(
      createElement(MinimalContinuationHeader, {
        customerName: "Prairie Water",
        artifactLabel: "Playbook",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("StatusBanner (smoke render)", () => {
  it("renders with severityBg.stop background for stop severity", async () => {
    const pdf = await renderDoc(
      createElement(StatusBanner, {
        severity: "stop",
        label: "COMPLIANCE & SAFETY — STOP",
        body: "Active H2S hazard.",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});

describe("FullWidthBanner (smoke render)", () => {
  it("renders with red tone", async () => {
    const pdf = await renderDoc(
      createElement(FullWidthBanner, { tone: "red", text: "DRAFT INTENT — INTERNAL ONLY" }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("KVTable", () => {
  it("renders without crashing when rows array is empty", async () => {
    const pdf = await renderDoc(createElement(KVTable, { rows: [] }));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders normally with populated rows", async () => {
    const pdf = await renderDoc(
      createElement(KVTable, {
        rows: [
          { label: "Scope", value: "Phase 1" },
          { label: "Budget", value: "$4M–$6M" },
        ],
      }),
    );
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});

describe("SectionHeading (smoke render)", () => {
  it("renders with index, title and accentColor", async () => {
    const pdf = await renderDoc(
      createElement(SectionHeading, {
        index: 1,
        title: "Evidence Base",
        accentColor: "#0090F0",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("WhyItMattersCallout (smoke render)", () => {
  it("renders a callout with items", async () => {
    const pdf = await renderDoc(
      createElement(WhyItMattersCallout, {
        items: ["Prevents permit breach", "Caps capital exposure"],
        accentColor: "#0090F0",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("SeverityToken (smoke render)", () => {
  it("renders a STOP token without error", async () => {
    const pdf = await renderDoc(createElement(SeverityToken, { severity: "stop" }));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("FlagListItem (smoke render)", () => {
  it("renders a flag item with all required fields", async () => {
    const pdf = await renderDoc(
      // biome-ignore lint/correctness/useUniqueElementIds: React PDF test data exercises artifact evidence IDs, not DOM IDs.
      createElement(FlagListItem, {
        id: "H2S-01",
        severity: "stop",
        evidence: "Portable monitor detected H2S at offload bay.",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("EvidenceAnchorInline (smoke render)", () => {
  it("renders an inline anchor node inside a Text parent", async () => {
    // EvidenceAnchorInline must be nested in a Text parent per design §2
    const pdf = await renderDoc(
      createElement(
        PdfText,
        null,
        "Capacity exceeded permit limit ",
        // biome-ignore lint/correctness/useUniqueElementIds: React PDF test data exercises artifact evidence IDs, not DOM IDs.
        createElement(EvidenceAnchorInline, { id: "PW-01" }),
      ),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("DataTable (smoke render)", () => {
  it("renders with navy-dark header style", async () => {
    const pdf = await renderDoc(
      createElement(DataTable, {
        columns: [
          { key: "name", header: "Name", flexBasis: 150 },
          { key: "value", header: "Value", flexBasis: 100 },
        ],
        rows: [
          { name: "Phase 1", value: "$800K" },
          { name: "Phase 2", value: "$1.2M" },
        ],
        headerStyle: "navy-dark",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders with plain header style and empty rows without crashing", async () => {
    const pdf = await renderDoc(
      createElement(DataTable, {
        columns: [{ key: "item", header: "Item", flexBasis: 200 }],
        rows: [],
        headerStyle: "plain",
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("Footer backward-compat", () => {
  it("renders text-only footer without TypeScript error (no label prop required)", async () => {
    // New Footer has no required props — renders the canonical text
    const pdf = await renderDoc(createElement(Footer, null));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
