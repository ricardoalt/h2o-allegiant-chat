import { describe, expect, it } from "vitest";
import type { AnalyticalReadPayload } from "../payloads";
import {
  analyticalEvidenceTagBorderColor,
  analyticalFlagSeverity,
  analyticalReadPagePaddingTop,
  analyticalSectionDefaultColor,
  collectTableHeaders,
  costConfidenceColor,
  gateStateToBanner,
  normalizeGateState,
  renderAnalyticalReadPdf,
  shouldRenderAnalyticalBanners,
} from "./analytical-read-document";
import { h2oBrand } from "./brand-tokens";
import { tier2ContinuationTopReserve } from "./shared-document";

const countPdfPages = (pdf: Buffer): number =>
  pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;

const payload: AnalyticalReadPayload = {
  customer: { location: "Prairie, TX", name: "Prairie Water", slug: "prairie-water" },
  title: "Prairie Water Analytical Read",
  summary: "Capacity strain plus NPDES horizon define the deal.",
  sections: [
    {
      heading: "Evidence base",
      body: "Flow data and permit history support the wet-weather lens.",
      evidenceTags: ["FLOW-DATA", "NPDES-RENEWAL"],
      table: [
        { Metric: "ADF (MGD)", Value: "3.4", Source: "Utility 2024 report" },
        { Metric: "Permit renewal", Value: "2027-Q2", Source: "TCEQ schedule" },
      ],
    },
    {
      heading: "Decision-maker matrix",
      body: "Utility director leads; finance committee approves capex.",
    },
  ],
};

describe("renderAnalyticalReadPdf", () => {
  it("uses the shared Tier 2 continuation top reserve for page body flow", () => {
    expect(analyticalReadPagePaddingTop).toBe(tier2ContinuationTopReserve);
  });

  it("renders a forced multi-page Analytical Read with the continuation reserve", async () => {
    const pdf = await renderAnalyticalReadPdf({
      ...payload,
      sections: Array.from({ length: 28 }, (_, index) => ({
        heading: `Dense evidence section ${index + 1}`,
        body: "This deliberately long analytical section forces continuation-page flow while the fixed header reserve remains active.",
        evidenceTags: ["FLOW", "PERMIT", "CAPEX"],
      })),
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(countPdfPages(pdf)).toBeGreaterThan(1);
  });

  it("renders a non-empty PDF from the typed Analytical Read payload", async () => {
    const pdf = await renderAnalyticalReadPdf(payload);

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("analyticalSectionDefaultColor", () => {
  it("returns the v3 brand blue for default section markers", () => {
    expect(analyticalSectionDefaultColor()).toBe(h2oBrand.colors.blue);
  });
});

describe("collectTableHeaders", () => {
  it("extracts all unique keys from an array of row objects in order", () => {
    const rows: Array<Record<string, string>> = [
      { Metric: "ADF", Value: "3.4" },
      { Metric: "Permit", Value: "2027", Source: "TCEQ" },
    ];
    expect(collectTableHeaders(rows)).toEqual(["Metric", "Value", "Source"]);
  });

  it("returns empty array for empty input", () => {
    expect(collectTableHeaders([])).toEqual([]);
  });
});

// ─── Slice 3b RED ─────────────────────────────────────────────────────────────

describe("analyticalEvidenceTagBorderColor", () => {
  it("returns the v3 line color for evidence tag chip border", () => {
    expect(analyticalEvidenceTagBorderColor()).toBe(h2oBrand.colors.line);
  });
});

// ─── Slice E RED ──────────────────────────────────────────────────────────────

describe("analyticalFlagSeverity", () => {
  it("maps exact task severities to shared primitive severities", () => {
    expect(analyticalFlagSeverity("STOP")).toBe("stop");
    expect(analyticalFlagSeverity("SPECIALIST")).toBe("specialist");
    expect(analyticalFlagSeverity("ATTENTION")).toBe("attention");
    expect(analyticalFlagSeverity("CLEAR")).toBe("clear");
  });

  it("normalizes mixed case, punctuation, and unknown values safely", () => {
    expect(analyticalFlagSeverity("stop-work")).toBe("stop");
    expect(analyticalFlagSeverity("Needs Specialist Review")).toBe("specialist");
    expect(analyticalFlagSeverity("watch attention item")).toBe("attention");
    expect(analyticalFlagSeverity("unknown")).toBe("attention");
  });
});

describe("costConfidenceColor", () => {
  it("maps confidence tiers to the required brand colors", () => {
    expect(costConfidenceColor("HIGH")).toBe(h2oBrand.colors.navy);
    expect(costConfidenceColor("MEDIUM")).toBe(h2oBrand.colors.amber);
    expect(costConfidenceColor("LOW")).toBe(h2oBrand.colors.red);
    expect(costConfidenceColor("QUALITATIVE")).toBe(h2oBrand.colors.muted);
  });

  it("normalizes case and falls back to muted for unknown tiers", () => {
    expect(costConfidenceColor("high")).toBe(h2oBrand.colors.navy);
    expect(costConfidenceColor("Medium confidence")).toBe(h2oBrand.colors.amber);
    expect(costConfidenceColor("unknown")).toBe(h2oBrand.colors.muted);
  });
});

describe("normalizeGateState", () => {
  it("normalizes recognized gate states across casing, whitespace, and separators", () => {
    expect(normalizeGateState(" open ")).toBe("OPEN");
    expect(normalizeGateState("OPEN_WITH_CONDITIONS")).toBe("OPEN-WITH-CONDITIONS");
    expect(normalizeGateState("conditionally_open")).toBe("CONDITIONALLY-OPEN");
    expect(normalizeGateState("closed")).toBe("CLOSED");
  });

  it("falls back to CLOSED for empty or unknown values", () => {
    expect(normalizeGateState()).toBe("CLOSED");
    expect(normalizeGateState("   ")).toBe("CLOSED");
    expect(normalizeGateState("PARTIAL")).toBe("CLOSED");
  });
});

describe("gateStateToBanner", () => {
  it("maps every recognized state to boss-reference label and severity", () => {
    expect(gateStateToBanner("OPEN")).toEqual({
      label: "QUALIFICATION GATE — OPEN",
      severity: "open",
      state: "OPEN",
    });
    expect(gateStateToBanner("OPEN-WITH-CONDITIONS")).toEqual({
      label: "QUALIFICATION GATE — OPEN (with conditions)",
      severity: "open-with-conditions",
      state: "OPEN-WITH-CONDITIONS",
    });
    expect(gateStateToBanner("CONDITIONALLY-OPEN")).toEqual({
      label: "QUALIFICATION GATE — CONDITIONALLY OPEN",
      severity: "conditionally-open",
      state: "CONDITIONALLY-OPEN",
    });
    expect(gateStateToBanner("CLOSED")).toEqual({
      label: "QUALIFICATION GATE — CLOSED",
      severity: "closed",
      state: "CLOSED",
    });
  });

  it("accepts underscore aliases and does not hardcode every banner as open", () => {
    expect(gateStateToBanner("OPEN_WITH_CONDITIONS").severity).toBe("open-with-conditions");
    expect(gateStateToBanner(" conditionally_open ").severity).toBe("conditionally-open");
    expect(gateStateToBanner("closed").severity).toBe("closed");
  });

  it("uses conservative CLOSED semantics for unknown values", () => {
    expect(gateStateToBanner("PARTIAL")).toEqual({
      label: "QUALIFICATION GATE — CLOSED",
      severity: "closed",
      state: "CLOSED",
    });
  });
});

describe("shouldRenderAnalyticalBanners", () => {
  it("suppresses both banners when gateState and flags are absent", () => {
    expect(shouldRenderAnalyticalBanners({})).toEqual({ gate: false, compliance: false });
  });

  it("renders gate and compliance independently", () => {
    expect(shouldRenderAnalyticalBanners({ gateState: "OPEN" })).toEqual({
      gate: true,
      compliance: false,
    });
    expect(
      shouldRenderAnalyticalBanners({
        flags: [{ id: "F-1", severity: "STOP", evidence: "Permit" }],
      }),
    ).toEqual({
      gate: false,
      compliance: true,
    });
  });
});

describe("renderAnalyticalReadPdf — Slice E", () => {
  it("renders a backward-compatible legacy payload without Slice E fields as one non-empty PDF", async () => {
    const pdf = await renderAnalyticalReadPdf({
      customer: payload.customer,
      summary: payload.summary,
      sections: [{ heading: "Legacy", body: "Legacy analytical read body." }],
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders recognized closed gate-state semantics without breaking PDF output", async () => {
    const pdf = await renderAnalyticalReadPdf({
      customer: payload.customer,
      gateContent: "Qualification gate is closed until safety evidence is resolved.",
      gateState: "CLOSED",
      sections: [{ body: "Safety evidence is incomplete.", heading: "Gate evidence" }],
      summary: "Gate is closed pending evidence.",
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders a full Slice E payload with banners, tables, costs, and evidence anchors", async () => {
    const pdf = await renderAnalyticalReadPdf({
      ...payload,
      customer: {
        ...payload.customer,
        basin: "Permian",
        county: "Reeves County",
        state: "TX",
      },
      gateState: "OPEN_WITH_CONDITIONS",
      gateContent: "Commercial gate remains open if permit evidence is confirmed.",
      flags: [
        {
          id: "SAF-01",
          severity: "STOP",
          evidence: "Confined-space entry record missing",
          status: "Open",
        },
        { id: "OPS-02", severity: "SPECIALIST", evidence: "Pretreatment review needed" },
      ],
      subStreamLens: [
        {
          subStream: "Wet weather",
          activeCondition: "Peaks exceed reserve",
          evidenceAnchor: "FLOW-01",
        },
      ],
      stageGapAnalysis: [{ required: "Permit file", status: "Partial", source: "TCEQ" }],
      costRows: [{ row: "Temporary hauling", basis: "$18k/month", confidence: "MEDIUM" }],
      sections: [
        {
          heading: "Evidence base",
          body: "Flow data supports the wet-weather lens.",
          evidenceSource: "FLOW-01",
          confidenceTier: "HIGH",
        },
      ],
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
