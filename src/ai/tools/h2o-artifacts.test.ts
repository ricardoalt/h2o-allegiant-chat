import type { ToolExecuteFunction } from "ai";
import { describe, expect, it, vi } from "vitest";
import type { ArtifactStore } from "@/lib/artifacts/artifact-store";
import { InMemoryArtifactPdfStorage } from "@/lib/artifacts/pdf-storage";
import type { OwnerContext } from "@/lib/auth/owner-context";
import {
  type ArtifactToolOutput,
  type ArtifactToolResult,
  analyticalReadInputSchema,
  createH2oArtifactTools,
  fieldBriefInputSchema,
  playbookInputSchema,
  proposalShellInputSchema,
} from "./h2o-artifacts";

const owner: OwnerContext = { identityId: "identity-1", userId: "user-1" };

const fieldBriefInput = {
  customer: { name: "Prairie Water", slug: "prairie-water" },
  stage: "Qualify",
  confidence: "MEDIUM",
  sections: {
    whatThisIs: {
      insight: "Lagoon pressure is the deal driver.",
      body: "Evidence points to capacity strain.",
    },
    whatWeWouldPropose: {
      insight: "Lead with modular capacity and avoided surcharge exposure.",
      recommendedApproach: "Modular treatment-stage expansion.",
      winWinArguments: [
        { lead: "Avoid delay", body: "Keeps the customer ahead of permit pressure." },
      ],
      costOfAlternativeRows: [
        { component: "Delay", theirPath: "$1M+ exposure", ourProposal: "Controlled capex" },
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

const playbookInput = {
  customer: { name: "Prairie Water", slug: "prairie-water" },
  themes: [{ title: "Budget", questions: ["Who owns capital approval?"] }],
};

const analyticalReadInput = {
  customer: { name: "Prairie Water", slug: "prairie-water" },
  summary: "Capacity strain plus NPDES horizon define the deal.",
  sections: [{ heading: "Evidence", body: "Flow data supports the wet-weather lens." }],
};

const proposalShellInput = {
  customer: { name: "Prairie Water", slug: "prairie-water" },
  executiveSummary: "Phased modular capacity caps capex.",
  proposedScope: ["Modular treatment-stage expansion"],
  sizingAndPricing: "Range $4.2M-$5.8M MEDIUM confidence.",
  schedule: "Mobilise Q3 2026.",
  commitments: [
    { label: "Commit to", text: "Phase-1 scope" },
    { label: "Do not commit yet", text: "Phase-2 sizing" },
  ],
};

const createStore = (): ArtifactStore => ({
  getActiveArtifact: vi.fn(),
  listArtifactsByThread: vi.fn(),
  putArtifact: vi.fn(async (input, artifactOwner) => ({
    id: "artifact-1",
    ownerIdentityId: artifactOwner.identityId,
    ownerUserId: artifactOwner.userId,
    threadId: input.threadId,
    kind: input.kind,
    status: input.status,
    title: input.title,
    customerSlug: input.customerSlug,
    payloadVersion: input.payloadVersion,
    payload: input.payload,
    createdAtIso: "2026-05-15T00:00:00.000Z",
    updatedAtIso: "2026-05-15T00:00:00.000Z",
  })),
});

const collectToolOutputs = async (tool: unknown, input: unknown): Promise<ArtifactToolOutput[]> => {
  const execute = (tool as { execute: ToolExecuteFunction<unknown, ArtifactToolOutput> }).execute;
  const result: unknown = await execute(input, { toolCallId: "tool-call-1", messages: [] });
  if (Symbol.asyncIterator in Object(result)) {
    const outputs: ArtifactToolOutput[] = [];
    for await (const output of result as AsyncIterable<ArtifactToolOutput>) {
      outputs.push(output);
    }
    return outputs;
  }
  return [result as ArtifactToolOutput];
};

const executeTool = async (tool: unknown, input: unknown): Promise<ArtifactToolResult> => {
  const outputs = await collectToolOutputs(tool, input);
  const result = outputs.at(-1);
  if (!result || result.status !== "ready") {
    throw new TypeError("artifact tool did not produce a final ready result");
  }
  return result;
};

describe("H2O artifact tool schemas", () => {
  it("accepts valid minimal inputs for all four artifact kinds", () => {
    expect(fieldBriefInputSchema.safeParse(fieldBriefInput).success).toBe(true);
    expect(
      playbookInputSchema.safeParse({
        customer: { name: "Prairie Water" },
        themes: [{ title: "Budget", questions: ["Who owns capital approval?"] }],
      }).success,
    ).toBe(true);
    expect(
      analyticalReadInputSchema.safeParse({
        customer: { name: "Prairie Water" },
        summary: "Capacity pressure is material.",
        sections: [{ heading: "Evidence", body: "NPDES schedule suggests urgency." }],
      }).success,
    ).toBe(true);
    expect(
      proposalShellInputSchema.safeParse({
        customer: { name: "Prairie Water" },
        executiveSummary: "A phased scope reduces risk.",
        proposedScope: ["Phase 1 assessment"],
        sizingAndPricing: "Directional only.",
        schedule: "30-60 days.",
        commitments: [
          { label: "Commit to", text: "Assessment" },
          { label: "Do not commit yet", text: "Final design" },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects malformed artifact inputs", () => {
    expect(fieldBriefInputSchema.safeParse({ ...fieldBriefInput, stage: "Unknown" }).success).toBe(
      false,
    );
    expect(
      fieldBriefInputSchema.safeParse({
        ...fieldBriefInput,
        sections: { ...fieldBriefInput.sections, doThisNext: { insight: "x", actions: [] } },
      }).success,
    ).toBe(false);
    expect(
      playbookInputSchema.safeParse({ customer: { name: "Prairie" }, themes: [] }).success,
    ).toBe(false);
  });
});

const getToolDescription = (tool: unknown): string =>
  (tool as { description?: string }).description ?? "";

describe("createH2oArtifactTools returns 4 atomic tools", () => {
  it("exposes exactly the four expected tool keys", () => {
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    expect(Object.keys(tools).sort()).toEqual(
      [
        "generateFieldBrief",
        "generatePlaybook",
        "generateAnalyticalRead",
        "generateProposalShell",
      ].sort(),
    );
  });

  it("describes only canonical Playbook header fields", () => {
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    const description = getToolDescription(tools.generatePlaybook);

    expect(description).toContain("Use header.subStreams, header.stageIntro, and header.insight");
    expect(description).not.toContain("subStreamsSummary");
    expect(description).not.toContain("leadStageIntro");
    expect(description).not.toContain("stageInsight");
    expect(description).not.toContain("legacy");
  });

  it("describes commitments as the single enriched Proposal commitments path", () => {
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    const description = getToolDescription(tools.generateProposalShell);

    expect(description).toContain(
      "Populate commitments with enriched commitment cards (label, text, optional date, optional owner)",
    );
    expect(description).not.toContain("commitmentsTyped");
    expect(description).not.toContain("legacy");
  });
});

describe("generateFieldBrief", () => {
  it("streams preliminary progress phases before the final field brief result", async () => {
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    const outputs = await collectToolOutputs(tools.generateFieldBrief, fieldBriefInput);

    expect(outputs.map((output) => output.status)).toEqual([
      "rendering",
      "storing",
      "persisting",
      "ready",
    ]);
    expect(outputs[0]).toMatchObject({
      artifactType: "field-brief",
      message: "Rendering PDF…",
      title: "Prairie Water Field Brief",
    });
    expect(outputs[1]).toMatchObject({ message: "Storing PDF…" });
    expect(outputs[2]).toMatchObject({ message: "Saving artifact metadata…" });
  }, 30_000);

  it("persists the field brief PDF and returns the correct output shape", async () => {
    const artifactStore = createStore();
    const pdfStorage = new InMemoryArtifactPdfStorage();
    const tools = createH2oArtifactTools({
      artifactStore,
      pdfStorage,
      owner,
      threadId: "thread-1",
    });

    const result = await executeTool(tools.generateFieldBrief, fieldBriefInput);

    expect(artifactStore.putArtifact).toHaveBeenCalledTimes(1);
    expect(result.artifactType).toBe("field-brief");
    expect(result.status).toBe("ready");
    expect(result.formats).toHaveLength(1);
    expect(result.formats[0].format).toBe("pdf");

    const stored = await pdfStorage.get({
      kind: "field-brief",
      threadId: "thread-1",
      userId: owner.userId,
    });
    expect(stored).not.toBeNull();
    expect(stored?.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});

describe("generatePlaybook", () => {
  it("persists the playbook PDF and returns the correct output shape", async () => {
    const artifactStore = createStore();
    const pdfStorage = new InMemoryArtifactPdfStorage();
    const tools = createH2oArtifactTools({
      artifactStore,
      pdfStorage,
      owner,
      threadId: "thread-1",
    });

    const result = await executeTool(tools.generatePlaybook, playbookInput);

    expect(artifactStore.putArtifact).toHaveBeenCalledTimes(1);
    expect(result.artifactType).toBe("playbook");
    expect(result.status).toBe("ready");
    expect(result.formats[0].format).toBe("pdf");
  }, 30_000);
});

describe("generateAnalyticalRead", () => {
  it("streams analytical-read progress before the final ready result", async () => {
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    const outputs = await collectToolOutputs(tools.generateAnalyticalRead, analyticalReadInput);

    expect(outputs.map((output) => output.status)).toEqual([
      "rendering",
      "storing",
      "persisting",
      "ready",
    ]);
    expect(outputs[0]).toMatchObject({
      artifactType: "analytical-read",
      title: "Analytical Read",
      message: "Rendering PDF…",
    });
    const final = outputs.at(-1);
    expect(final).toMatchObject({ artifactType: "analytical-read", status: "ready" });
  }, 30_000);

  it("persists the analytical read PDF and returns the correct output shape", async () => {
    const artifactStore = createStore();
    const pdfStorage = new InMemoryArtifactPdfStorage();
    const tools = createH2oArtifactTools({
      artifactStore,
      pdfStorage,
      owner,
      threadId: "thread-1",
    });

    const result = await executeTool(tools.generateAnalyticalRead, analyticalReadInput);

    expect(artifactStore.putArtifact).toHaveBeenCalledTimes(1);
    expect(result.artifactType).toBe("analytical-read");
    expect(result.status).toBe("ready");
    expect(result.formats[0].format).toBe("pdf");
  }, 30_000);
});

describe("generateProposalShell", () => {
  it("persists the proposal shell PDF and returns the correct output shape", async () => {
    const artifactStore = createStore();
    const pdfStorage = new InMemoryArtifactPdfStorage();
    const tools = createH2oArtifactTools({
      artifactStore,
      pdfStorage,
      owner,
      threadId: "thread-1",
    });

    const result = await executeTool(tools.generateProposalShell, proposalShellInput);

    expect(artifactStore.putArtifact).toHaveBeenCalledTimes(1);
    expect(result.artifactType).toBe("proposal-shell");
    expect(result.status).toBe("ready");
    expect(result.formats[0].format).toBe("pdf");
  }, 30_000);
});

describe("artifact tool observability", () => {
  it("logs structured execute, render, storage, and persist lifecycle events without payload content", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    await executeTool(tools.generateFieldBrief, fieldBriefInput);

    expect(logSpy).toHaveBeenCalledWith(
      "[h2o-artifacts] artifact_tool_started",
      expect.objectContaining({
        event: "artifact_tool_started",
        kind: "field-brief",
        threadId: "thread-1",
        toolCallId: "tool-call-1",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[h2o-artifacts] artifact_render_finished",
      expect.objectContaining({
        event: "artifact_render_finished",
        kind: "field-brief",
        byteLength: expect.any(Number),
        durationMs: expect.any(Number),
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[h2o-artifacts] artifact_pdf_storage_finished",
      expect.objectContaining({ event: "artifact_pdf_storage_finished", kind: "field-brief" }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[h2o-artifacts] artifact_db_persist_finished",
      expect.objectContaining({
        event: "artifact_db_persist_finished",
        kind: "field-brief",
        artifactId: "artifact-1",
      }),
    );
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("Lagoon pressure is the deal driver");

    logSpy.mockRestore();
  }, 30_000);

  it("logs structured failure information without leaking error message payload content", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const renderModule = await import("@/lib/artifacts/pdf-renderer-dispatch");
    const renderSpy = vi
      .spyOn(renderModule, "renderArtifactPdf")
      .mockRejectedValueOnce(
        new TypeError("render failure for Lagoon pressure is the deal driver"),
      );
    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    await expect(executeTool(tools.generateFieldBrief, fieldBriefInput)).rejects.toThrow(
      "render failure",
    );

    expect(errorSpy).toHaveBeenCalledWith(
      "[h2o-artifacts] artifact_tool_failed",
      expect.objectContaining({
        event: "artifact_tool_failed",
        kind: "field-brief",
        threadId: "thread-1",
        toolCallId: "tool-call-1",
        errorClass: "TypeError",
        errorMessage: "redacted",
      }),
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("Lagoon pressure is the deal driver");

    renderSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("propagates render failure", () => {
  it("rejects when renderArtifactPdf throws", async () => {
    const renderModule = await import("@/lib/artifacts/pdf-renderer-dispatch");
    const renderSpy = vi
      .spyOn(renderModule, "renderArtifactPdf")
      .mockRejectedValueOnce(new Error("render failure"));

    const tools = createH2oArtifactTools({
      artifactStore: createStore(),
      pdfStorage: new InMemoryArtifactPdfStorage(),
      owner,
      threadId: "thread-1",
    });

    await expect(executeTool(tools.generateFieldBrief, fieldBriefInput)).rejects.toThrow(
      "render failure",
    );

    renderSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Slice B — Schema enrichment: RED tests (run before implementation)
// All tests in this block validate new optional fields added in Slice B.
// They must pass after schema changes and must not require renderer changes.
// ---------------------------------------------------------------------------

describe("fieldBriefInputSchema — Slice B additive fields", () => {
  it("parses legacy payload without new fields (backward compat)", () => {
    const result = fieldBriefInputSchema.safeParse(fieldBriefInput);
    expect(result.success).toBe(true);
  });

  it("accepts customer.county, customer.state, customer.basin as optional strings", () => {
    const input = {
      ...fieldBriefInput,
      customer: {
        ...fieldBriefInput.customer,
        county: "Lancaster",
        state: "NE",
        basin: "Platte River",
      },
    };
    const result = fieldBriefInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer.county).toBe("Lancaster");
      expect(result.data.customer.state).toBe("NE");
      expect(result.data.customer.basin).toBe("Platte River");
    }
  });

  it("accepts narrativeRiskCallouts as optional string array", () => {
    const input = {
      ...fieldBriefInput,
      narrativeRiskCallouts: [
        "Budget freeze risk is woven into the cost discussion above.",
        "Regulatory delay risk addressed in proposed scope.",
      ],
    };
    const result = fieldBriefInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.narrativeRiskCallouts).toHaveLength(2);
    }
  });

  it("accepts payload with both stopFlags and narrativeRiskCallouts simultaneously", () => {
    const input = {
      ...fieldBriefInput,
      stopFlags: [{ title: "Budget freeze", summary: "Capital window at risk." }],
      narrativeRiskCallouts: ["Risk woven into prose."],
    };
    expect(fieldBriefInputSchema.safeParse(input).success).toBe(true);
  });

  it("omits customer.county/state/basin gracefully when absent", () => {
    const result = fieldBriefInputSchema.safeParse(fieldBriefInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer.county).toBeUndefined();
      expect(result.data.customer.state).toBeUndefined();
      expect(result.data.customer.basin).toBeUndefined();
      expect(result.data.narrativeRiskCallouts).toBeUndefined();
    }
  });
});

describe("playbookInputSchema — Slice B additive fields", () => {
  it("parses legacy payload without new fields (backward compat)", () => {
    const result = playbookInputSchema.safeParse(playbookInput);
    expect(result.success).toBe(true);
  });

  it("accepts themes[].whyItMatters as optional string array per theme", () => {
    const input = {
      ...playbookInput,
      themes: [
        {
          title: "Budget",
          questions: ["Who owns capital approval?"],
          whyItMatters: ["Unlocking capital is the rate-limiter.", "Board cycle is Q3."],
        },
      ],
    };
    const result = playbookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.themes[0].whyItMatters).toHaveLength(2);
    }
  });

  it("accepts themes[].accentIndex as optional non-negative integer", () => {
    const input = {
      ...playbookInput,
      themes: [{ title: "Budget", questions: ["Who owns capital approval?"], accentIndex: 2 }],
    };
    const result = playbookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.themes[0].accentIndex).toBe(2);
    }
  });

  it("rejects themes[].accentIndex when negative", () => {
    const input = {
      ...playbookInput,
      themes: [{ title: "Budget", questions: ["Who owns capital approval?"], accentIndex: -1 }],
    };
    expect(playbookInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects removed Playbook header aliases", () => {
    const input = {
      ...playbookInput,
      header: {
        subStreamsSummary: "Budget · Decision Authority · NPDES Compliance",
        leadStageIntro: "This playbook structures the first qualifying conversation.",
        stageInsight: "Customer is at decision-readiness threshold; capital approval is the gate.",
      },
    };

    expect(playbookInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects removed Playbook orientation field", () => {
    const input = {
      ...playbookInput,
      orientation: "Legacy orientation text",
    };

    expect(playbookInputSchema.safeParse(input).success).toBe(false);
  });

  it("accepts canonical header names subStreams, stageIntro, insight", () => {
    const input = {
      ...playbookInput,
      header: {
        subStreams: ["Budget", "Decision Authority", "NPDES Compliance"],
        stageIntro: "This playbook structures the first qualifying conversation.",
        insight: "Customer is at decision-readiness threshold; capital approval is the gate.",
      },
    };
    const result = playbookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.header?.subStreams).toEqual([
        "Budget",
        "Decision Authority",
        "NPDES Compliance",
      ]);
      expect(result.data.header?.stageIntro).toBeDefined();
      expect(result.data.header?.insight).toBeDefined();
    }
  });

  it("accepts partial canonical header with only some fields populated", () => {
    const input = {
      ...playbookInput,
      header: { subStreams: ["Budget", "NPDES"] },
    };
    expect(playbookInputSchema.safeParse(input).success).toBe(true);
  });
});

describe("analyticalReadInputSchema — Slice B additive fields", () => {
  it("parses legacy payload without new fields (backward compat)", () => {
    const result = analyticalReadInputSchema.safeParse(analyticalReadInput);
    expect(result.success).toBe(true);
  });

  it("accepts gateState enum values", () => {
    for (const state of ["OPEN", "OPEN_WITH_CONDITIONS", "CONDITIONALLY_OPEN", "CLOSED"] as const) {
      const input = { ...analyticalReadInput, gateState: state };
      const result = analyticalReadInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gateState).toBe(state);
      }
    }
  });

  it("rejects unknown gateState values", () => {
    const input = { ...analyticalReadInput, gateState: "PARTIALLY_OPEN" };
    expect(analyticalReadInputSchema.safeParse(input).success).toBe(false);
  });

  it("accepts gateContent as optional string", () => {
    const input = {
      ...analyticalReadInput,
      gateState: "OPEN_WITH_CONDITIONS" as const,
      gateContent: "Open pending NPDES permit renewal confirmation.",
    };
    const result = analyticalReadInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gateContent).toBe("Open pending NPDES permit renewal confirmation.");
    }
  });

  it("accepts flags array with id, severity, evidence, and optional status", () => {
    const input = {
      ...analyticalReadInput,
      flags: [
        { id: "PW-01", severity: "STOP", evidence: "Permit expiry within 90 days." },
        {
          id: "PW-02",
          severity: "SPECIALIST",
          evidence: "Biosolids handling requires regulatory specialist.",
          status: "Under review",
        },
        { id: "PW-03", severity: "ATTENTION", evidence: "Flow meter calibration overdue." },
        { id: "PW-04", severity: "CLEAR", evidence: "Operator licence current." },
      ],
    };
    const result = analyticalReadInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const flags = result.data.flags ?? [];
      expect(flags).toHaveLength(4);
      expect(flags[0].severity).toBe("STOP");
      expect(flags[1].status).toBe("Under review");
      expect(flags[2].severity).toBe("ATTENTION");
      expect(flags[3].severity).toBe("CLEAR");
    }
  });

  it("rejects flag with unknown severity", () => {
    const input = {
      ...analyticalReadInput,
      flags: [{ id: "PW-99", severity: "CRITICAL", evidence: "Unknown." }],
    };
    expect(analyticalReadInputSchema.safeParse(input).success).toBe(false);
  });

  it("accepts subStreamLens array", () => {
    const input = {
      ...analyticalReadInput,
      subStreamLens: [
        {
          subStream: "Lagoon Capacity",
          activeCondition: "At 92% seasonal peak",
          evidenceAnchor: "PW-01",
        },
      ],
    };
    const result = analyticalReadInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subStreamLens).toHaveLength(1);
    }
  });

  it("accepts stageGapAnalysis array", () => {
    const input = {
      ...analyticalReadInput,
      stageGapAnalysis: [
        { required: "NPDES compliance schedule", status: "Requested", source: "Field visit" },
      ],
    };
    expect(analyticalReadInputSchema.safeParse(input).success).toBe(true);
  });

  it("accepts costRows array with confidence enum", () => {
    const input = {
      ...analyticalReadInput,
      costRows: [
        { row: "Capital cost", basis: "Comparable project", confidence: "HIGH" as const },
        { row: "O&M delta", basis: "Estimate", confidence: "MEDIUM" as const },
        { row: "Delay cost", basis: "Qualitative", confidence: "QUALITATIVE" as const },
      ],
    };
    const result = analyticalReadInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costRows).toHaveLength(3);
    }
  });

  it("rejects costRows with unknown confidence value", () => {
    const input = {
      ...analyticalReadInput,
      costRows: [{ row: "Capital", basis: "Estimate", confidence: "VERY_HIGH" }],
    };
    expect(analyticalReadInputSchema.safeParse(input).success).toBe(false);
  });

  it("accepts sections[].evidenceSource and sections[].confidenceTier", () => {
    const input = {
      ...analyticalReadInput,
      sections: [
        {
          heading: "Evidence",
          body: "NPDES schedule suggests urgency.",
          evidenceTags: [],
          evidenceSource: "[PW-01]",
          confidenceTier: "HIGH" as const,
        },
      ],
    };
    const result = analyticalReadInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections[0].evidenceSource).toBe("[PW-01]");
      expect(result.data.sections[0].confidenceTier).toBe("HIGH");
    }
  });

  it("rejects sections[].confidenceTier with unknown value", () => {
    const input = {
      ...analyticalReadInput,
      sections: [
        {
          heading: "Evidence",
          body: "Body text.",
          evidenceTags: [],
          confidenceTier: "VERY_HIGH",
        },
      ],
    };
    expect(analyticalReadInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("proposalShellInputSchema — Slice B additive fields", () => {
  it("parses legacy payload without new fields (backward compat)", () => {
    const result = proposalShellInputSchema.safeParse(proposalShellInput);
    expect(result.success).toBe(true);
  });

  it("accepts draftIntentBanner as optional boolean defaulting to true", () => {
    // absent → default true
    const r1 = proposalShellInputSchema.safeParse(proposalShellInput);
    expect(r1.success).toBe(true);
    if (r1.success) {
      expect(r1.data.draftIntentBanner).toBe(true);
    }
    // explicit false
    const r2 = proposalShellInputSchema.safeParse({
      ...proposalShellInput,
      draftIntentBanner: false,
    });
    expect(r2.success).toBe(true);
    if (r2.success) {
      expect(r2.data.draftIntentBanner).toBe(false);
    }
  });

  it("accepts internalOnlyFooterBanner as optional boolean defaulting to true", () => {
    const r1 = proposalShellInputSchema.safeParse(proposalShellInput);
    expect(r1.success).toBe(true);
    if (r1.success) {
      expect(r1.data.internalOnlyFooterBanner).toBe(true);
    }
    const r2 = proposalShellInputSchema.safeParse({
      ...proposalShellInput,
      internalOnlyFooterBanner: false,
    });
    expect(r2.success).toBe(true);
    if (r2.success) {
      expect(r2.data.internalOnlyFooterBanner).toBe(false);
    }
  });

  it("accepts statusOfDocument as optional string", () => {
    const input = { ...proposalShellInput, statusOfDocument: "DRAFT — not for distribution." };
    const result = proposalShellInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statusOfDocument).toBe("DRAFT — not for distribution.");
    }
  });

  it("accepts workPackages array", () => {
    const input = {
      ...proposalShellInput,
      workPackages: [
        {
          id: "WP-1",
          name: "Site Assessment",
          outcome: "Confirmed flow data and permit timeline.",
        },
        { id: "WP-2", name: "Modular Design", outcome: "Preliminary design and CAPEX estimate." },
      ],
    };
    const result = proposalShellInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const workPackages = result.data.workPackages ?? [];
      expect(workPackages).toHaveLength(2);
      expect(workPackages[0].id).toBe("WP-1");
    }
  });

  it("accepts sizingRows array", () => {
    const input = {
      ...proposalShellInput,
      sizingRows: [
        { label: "CAPEX estimate", value: "$4.2M–$5.8M" },
        { label: "Confidence", value: "MEDIUM" },
      ],
    };
    expect(proposalShellInputSchema.safeParse(input).success).toBe(true);
  });

  it("accepts outOfScope array with heading and body", () => {
    const input = {
      ...proposalShellInput,
      outOfScope: [
        {
          heading: "Phase 2 design",
          body: "Full detailed design is excluded from this engagement.",
        },
      ],
    };
    const result = proposalShellInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const outOfScope = result.data.outOfScope ?? [];
      expect(outOfScope[0].heading).toBe("Phase 2 design");
    }
  });

  it("accepts gatesToClose array", () => {
    const input = {
      ...proposalShellInput,
      gatesToClose: [
        { gate: "NPDES compliance schedule confirmed", closer: "H2O regulatory specialist" },
      ],
    };
    expect(proposalShellInputSchema.safeParse(input).success).toBe(true);
  });

  it("accepts canonical enriched commitments array with label/text/date/owner", () => {
    const input = {
      ...proposalShellInput,
      commitments: [
        {
          label: "Scope delivery",
          text: "Phase-1 scope document",
          date: "2026-07-15",
          owner: "H2O PM",
        },
        { label: "Pricing", text: "CAPEX estimate ±15%", owner: "H2O Estimating" },
      ],
    };
    const result = proposalShellInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.commitments).toHaveLength(2);
      expect(result.data.commitments[0].date).toBe("2026-07-15");
      expect(result.data.commitments[1].owner).toBe("H2O Estimating");
      expect(result.data.commitments[1].date).toBeUndefined();
    }
  });

  it("rejects removed legacy commitments object shape", () => {
    const input = {
      ...proposalShellInput,
      commitments: { commitTo: ["Scope"], doNotCommitYet: ["Later"] },
    };
    expect(proposalShellInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("cleans up orphan S3 object when artifact persistence fails", () => {
  it("deletes the just-written PDF from pdfStorage if putArtifact rejects", async () => {
    const pdfStorage = new InMemoryArtifactPdfStorage();
    const artifactStore: ArtifactStore = {
      ...createStore(),
      putArtifact: vi.fn().mockRejectedValueOnce(new Error("ddb conditional check failed")),
    };

    const tools = createH2oArtifactTools({
      artifactStore,
      pdfStorage,
      owner,
      threadId: "thread-1",
    });

    await expect(executeTool(tools.generateFieldBrief, fieldBriefInput)).rejects.toThrow(
      "ddb conditional check failed",
    );

    // The orphan PDF must be gone — pdfStorage.get returns null after cleanup.
    const stored = await pdfStorage.get({
      kind: "field-brief",
      threadId: "thread-1",
      userId: owner.userId,
    });
    expect(stored).toBeNull();
  }, 30_000);
});
