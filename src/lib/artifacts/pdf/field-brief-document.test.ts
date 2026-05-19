import { describe, expect, it } from "vitest";
import type { FieldBriefPayload } from "../payloads";
import { h2oBrand } from "./brand-tokens";
import {
  buildFieldBriefMetadataLine,
  buildFieldBriefTitle,
  chooseStopFlagPresentation,
  costRowStyleRole,
  fieldBriefContinuationLabel,
  renderFieldBriefPdf,
  riskRankColor,
  sectionMarkerColor,
  splitCostRowsForTwoPageBrief,
} from "./field-brief-document";

const countPdfPages = (pdf: Buffer): number =>
  pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;

const payload: FieldBriefPayload = {
  customer: { location: "Prairie, TX", name: "Prairie Water", slug: "prairie-water" },
  stage: "Qualify",
  confidence: "MEDIUM",
  date: "2026-05-15",
  stopFlags: [{ title: "Budget timing", summary: "Capital approval may slip." }],
  sections: {
    whatThisIs: {
      insight: "Lagoon pressure is the deal driver.",
      body: "Evidence points to capacity strain and NPDES schedule pressure.",
    },
    whatWeWouldPropose: {
      insight: "Lead with modular capacity and avoided surcharge exposure.",
      recommendedApproach: "Modular treatment-stage expansion with a narrow first-phase scope.",
      winWinArguments: [
        { lead: "Avoid delay", body: "Keeps the customer ahead of permit pressure." },
        { lead: "Control spend", body: "Makes the capital request easier to stage." },
      ],
      costOfAlternativeRows: [
        { component: "Delay", theirPath: "$1M+ exposure", ourProposal: "Controlled capex" },
        { component: "Total", theirPath: "Unbounded", ourProposal: "Phased", isTotal: true },
      ],
      dealSizeSensitivity: "Validate budget range before promising final design.",
    },
    whatCouldKillIt: {
      insight: "Budget timing can stall the deal.",
      risks: [
        {
          name: "Budget freeze",
          mechanism: "Capital window slips.",
          mitigation: "Anchor phased scope.",
        },
      ],
    },
    doThisNext: {
      insight: "Close the data gap this week.",
      actions: [
        { title: "Ask for NPDES schedule", timeframe: "7 days", body: "Confirm deadlines." },
        {
          title: "Map decision roles",
          timeframe: "14 days",
          body: "Identify utility and finance owners.",
        },
        { title: "Draft scope", timeframe: "21 days", body: "Prepare modular option." },
      ],
    },
  },
};

const richPayload: FieldBriefPayload = {
  ...payload,
  customer: {
    location: "Reeves County, TX",
    name: "Llano Vista Midstream — Pecos East Station",
    slug: "llano-vista",
  },
  stopFlags: [
    {
      title: "H2S active worker safety hazard",
      summary:
        "Portable monitor detected H2S at offload bay and EQ tanks. No fixed detection on site. Active inhalation pathway creates safety and liability exposure.",
    },
    {
      title: "Unpermitted surface discharge",
      summary:
        "Stormwater pond emergency spillway released produced-water-contaminated effluent to ephemeral drainage with multiple off-site exceedances.",
    },
  ],
  sections: {
    ...payload.sections,
    whatThisIs: {
      insight:
        "This isn't three discrete incidents — it is a systemic produced-water management failure across five systems, with brine and BTEX confirmed in off-site drainage right now.",
      body: `${payload.sections.whatThisIs.body} The facility has no TPDES/NPDES authorization for any surface discharge, and the enforcement exposure is live across TCEQ, RRC, and OSHA.`,
    },
    whatWeWouldPropose: {
      ...payload.sections.whatWeWouldPropose,
      recommendedApproach:
        "Phase 1: transfer-line integrity investigation, stormwater remediation, NORM characterization, H2S controls, manifest audit, and regulatory disclosure. Phase 2: separation, filtration, dosing automation, closed-loop segregation, disposal-well remediation, SCADA rationalization, training, and SOP package.",
      winWinArguments: [
        ...payload.sections.whatWeWouldPropose.winWinArguments,
        {
          lead: "Close safety exposure",
          body: "Fixed detection and controls remove the fastest-moving OSHA risk.",
        },
      ],
      costOfAlternativeRows: [
        {
          component: "Phase 1 point fix",
          theirPath: "$200K–$400K",
          ourProposal: "$800K–$2M integrated stabilization",
        },
        {
          component: "Civil penalties",
          theirPath: "$3M–$10M+ risk",
          ourProposal: "Mitigated through proactive disclosure",
        },
        {
          component: "NORM soil",
          theirPath: "$500K–$2M forced scope",
          ourProposal: "$200K–$600K controlled scope",
        },
        {
          component: "H2S incident",
          theirPath: "Material, uncapped",
          ourProposal: "$50K–$150K controls",
        },
        {
          component: "Reuse rejection",
          theirPath: "$300K–$800K/yr",
          ourProposal: "Eliminated after remediation",
        },
        {
          component: "5-year total",
          theirPath: "$5M–$15M+ uncapped",
          ourProposal: "$4M–$11.5M closed",
          isTotal: true,
        },
      ],
    },
    whatCouldKillIt: {
      insight:
        "Speed is the variable. The enforcement clock is running and point-fix contractors are the default.",
      risks: [
        {
          name: "Enforcement-forced fast path",
          mechanism:
            "If regulators issue formal written notice before we engage, legal counsel directs a minimum corrective-action procurement.",
          mitigation: "Engage immediately and lead with the regulatory disclosure package.",
        },
        {
          name: "No capital-authority decision maker",
          mechanism:
            "Facility EHS managers typically cannot commit remediation capex without corporate approval.",
          mitigation: "Map the approval chain in the first call.",
        },
        {
          name: "Point-fix contractors frame the scope",
          mechanism:
            "Pipeline and pond-liner contractors are faster to mobilize and cheaper on the visible scope.",
          mitigation: "Use the five-year cost table to show why point fixes are not cheaper.",
        },
      ],
    },
  },
};

describe("Field Brief v3 visual helpers", () => {
  it("maps section marker colors to the v3 reference categories", () => {
    expect(sectionMarkerColor("what-this-is")).toBe(h2oBrand.colors.blue);
    expect(sectionMarkerColor("what-we-would-propose")).toBe(h2oBrand.colors.green);
    expect(sectionMarkerColor("what-could-kill-it")).toBe(h2oBrand.colors.red);
    expect(sectionMarkerColor("do-this-next")).toBe(h2oBrand.colors.navy);
  });

  it("uses stop severity for the first risk and amber severity for follow-up risks", () => {
    expect(riskRankColor(1)).toBe(h2oBrand.colors.severity.stop);
    expect(riskRankColor(2)).toBe(h2oBrand.colors.severity.specialist);
    expect(riskRankColor(3)).toBe(h2oBrand.colors.severity.specialist);
  });

  it("classifies cost table rows so total cells get red/green emphasis", () => {
    expect(costRowStyleRole({ isTotal: false, column: "theirPath" })).toBe("body");
    expect(costRowStyleRole({ isTotal: true, column: "theirPath" })).toBe("total-negative");
    expect(costRowStyleRole({ isTotal: true, column: "ourProposal" })).toBe("total-positive");
  });

  it("builds the page-2 continuation header label from the customer name", () => {
    expect(fieldBriefContinuationLabel("Llano Vista Midstream")).toBe(
      "Llano Vista Midstream · Field Brief (continued)",
    );
  });

  it("splits dense cost rows so page 1 keeps only a compact table opening", () => {
    const rows = richPayload.sections.whatWeWouldPropose.costOfAlternativeRows;

    expect(splitCostRowsForTwoPageBrief(rows)).toMatchObject({
      pageOneRows: rows.slice(0, 2),
      pageTwoRows: rows.slice(2),
    });
  });
});

describe("renderFieldBriefPdf", () => {
  it("renders a non-empty PDF from the typed Field Brief payload", async () => {
    const pdf = await renderFieldBriefPdf(payload);

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("keeps a dense reference-like Field Brief to exactly two rendered PDF pages", async () => {
    const pdf = await renderFieldBriefPdf(richPayload);

    expect(countPdfPages(pdf)).toBe(2);
  });
});

// ─── Slice C — RED tests ──────────────────────────────────────────────────────

describe("chooseStopFlagPresentation", () => {
  it("returns 'narrative' when narrativeRiskCallouts is non-empty (Option A: narrative wins)", () => {
    expect(
      chooseStopFlagPresentation({
        narrativeRiskCallouts: ["Enforcement clock is running."],
        stopFlags: [{ title: "Budget freeze", summary: "Capital window slips." }],
      }),
    ).toBe("narrative");
  });

  it("returns 'narrative' when only narrativeRiskCallouts is present (no stopFlags)", () => {
    expect(
      chooseStopFlagPresentation({
        narrativeRiskCallouts: ["No fixed detection on site."],
        stopFlags: undefined,
      }),
    ).toBe("narrative");
  });

  it("returns 'blocks' when narrativeRiskCallouts is absent and stopFlags is non-empty", () => {
    expect(
      chooseStopFlagPresentation({
        narrativeRiskCallouts: undefined,
        stopFlags: [{ title: "Budget freeze", summary: "Capital window slips." }],
      }),
    ).toBe("blocks");
  });

  it("returns 'blocks' when narrativeRiskCallouts is empty array and stopFlags is non-empty", () => {
    expect(
      chooseStopFlagPresentation({
        narrativeRiskCallouts: [],
        stopFlags: [{ title: "Budget freeze", summary: "Capital window slips." }],
      }),
    ).toBe("blocks");
  });

  it("returns 'none' when both narrativeRiskCallouts is absent/empty and stopFlags is empty/absent", () => {
    expect(
      chooseStopFlagPresentation({
        narrativeRiskCallouts: undefined,
        stopFlags: undefined,
      }),
    ).toBe("none");

    expect(
      chooseStopFlagPresentation({
        narrativeRiskCallouts: [],
        stopFlags: [],
      }),
    ).toBe("none");
  });
});

describe("buildFieldBriefMetadataLine", () => {
  it("renders full line with county, state, basin, date, and fixed tokens", () => {
    expect(
      buildFieldBriefMetadataLine({
        county: "Reeves County",
        state: "TX",
        basin: "Pecos",
        date: "2026-05-15",
      }),
    ).toBe("Reeves County, TX (Pecos) · 2026-05-15 · Field Brief · Internal handover");
  });

  it("omits the basin parenthetical when basin is absent", () => {
    expect(
      buildFieldBriefMetadataLine({
        county: "Reeves County",
        state: "TX",
        basin: undefined,
        date: "2026-05-15",
      }),
    ).toBe("Reeves County, TX · 2026-05-15 · Field Brief · Internal handover");
  });

  it("omits county+state when county is absent (graceful fallback per R11)", () => {
    expect(
      buildFieldBriefMetadataLine({
        county: undefined,
        state: "TX",
        basin: "Pecos",
        date: "2026-05-15",
      }),
    ).toBe("2026-05-15 · Field Brief · Internal handover");
  });

  it("omits county+state when state is absent (graceful fallback per R11)", () => {
    expect(
      buildFieldBriefMetadataLine({
        county: "Reeves County",
        state: undefined,
        basin: "Pecos",
        date: "2026-05-15",
      }),
    ).toBe("2026-05-15 · Field Brief · Internal handover");
  });

  it("renders minimal line when only date is present", () => {
    expect(
      buildFieldBriefMetadataLine({
        county: undefined,
        state: undefined,
        basin: undefined,
        date: "2026-05-15",
      }),
    ).toBe("2026-05-15 · Field Brief · Internal handover");
  });

  it("omits date from line when date is absent", () => {
    expect(
      buildFieldBriefMetadataLine({
        county: "Reeves County",
        state: "TX",
        basin: undefined,
        date: undefined,
      }),
    ).toBe("Reeves County, TX · Field Brief · Internal handover");
  });
});

describe("buildFieldBriefTitle (R3: H1 = customer.name — customer.location)", () => {
  it("concatenates name and location when both are present", () => {
    expect(
      buildFieldBriefTitle({
        name: "Llano Vista Midstream",
        location: "Pecos East Station",
      }),
    ).toBe("Llano Vista Midstream — Pecos East Station");
  });

  it("falls back to name only when location is absent (R11 backward compat)", () => {
    expect(buildFieldBriefTitle({ name: "Llano Vista Midstream" })).toBe("Llano Vista Midstream");
  });

  it("falls back to name only when location is empty string", () => {
    expect(buildFieldBriefTitle({ name: "Llano Vista Midstream", location: "" })).toBe(
      "Llano Vista Midstream",
    );
  });
});

describe("Slice C — dense fixture with narrativeRiskCallouts stays ≤ 2 pages", () => {
  it("renders a dense new-fields Field Brief (narrativeRiskCallouts + full cost table) in ≤ 2 pages", async () => {
    const denseNewPayload: FieldBriefPayload = {
      ...richPayload,
      customer: {
        ...richPayload.customer,
        county: "Reeves County",
        state: "TX",
        basin: "Pecos",
      },
      narrativeRiskCallouts: [
        "Enforcement clock is running — TCEQ and RRC have active inspection cycles and the unpermitted discharge is visible from satellite.",
        "H2S detection gap creates immediate OSHA 29 CFR 1910.119 exposure. No fixed monitors means no documented response protocol.",
        "Point-fix contractors are already mobilized on the stormwater pond. Every day without an integrated scope is a day they frame the narrative.",
      ],
      stopFlags: [
        {
          title: "H2S active worker safety hazard",
          summary: "Portable monitor detected H2S. No fixed detection.",
        },
      ],
    };

    const pdf = await renderFieldBriefPdf(denseNewPayload);
    expect(countPdfPages(pdf)).toBeLessThanOrEqual(2);
  });
});

describe("Slice C — backward compat: legacy payload without new fields renders successfully", () => {
  it("renders a legacy payload (no county/state/basin/narrativeRiskCallouts) without error", async () => {
    const legacyPayload: FieldBriefPayload = {
      customer: { location: "Prairie, TX", name: "Prairie Water", slug: "prairie-water" },
      stage: "Qualify",
      date: "2026-05-15",
      sections: {
        whatThisIs: {
          insight: "Lagoon pressure is the deal driver.",
          body: "Evidence points to capacity strain.",
        },
        whatWeWouldPropose: {
          insight: "Lead with modular capacity.",
          recommendedApproach: "Modular treatment-stage expansion.",
          winWinArguments: [{ lead: "Avoid delay", body: "Keeps ahead of permit pressure." }],
          costOfAlternativeRows: [
            { component: "Total", theirPath: "Unbounded", ourProposal: "Phased", isTotal: true },
          ],
        },
        whatCouldKillIt: {
          insight: "Budget timing can stall the deal.",
          risks: [
            {
              name: "Budget freeze",
              mechanism: "Capital window slips.",
              mitigation: "Anchor phased scope.",
            },
          ],
        },
        doThisNext: {
          insight: "Close the data gap this week.",
          actions: [
            { title: "Ask for NPDES schedule", timeframe: "7 days", body: "Confirm deadlines." },
          ],
        },
      },
    };

    const pdf = await renderFieldBriefPdf(legacyPayload);
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
