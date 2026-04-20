import { describe, expect, it, vi } from "vitest";

// Mock the ai module to avoid opentelemetry issues in tests
vi.mock("ai", () => ({
  tool: vi.fn((config: any) => config),
}));

const { loadSkillTool } = await import("./load-skill");

describe("loadSkillTool", () => {
  it("debería cargar skill existente correctamente", async () => {
    const result = await loadSkillTool.execute({ name: "commercial-shaping" }, {
      toolCallId: "test-1",
      messages: [],
    });

    expect(result.loaded).toBe(true);
    expect(result.skillName).toBe("commercial-shaping");
    expect(result.content).toContain("Commercial shaping");
    expect(result.content).toContain("Opportunity sizing");
    expect(result.error).toBeUndefined();
  });

  it("debería manejar skill no existente", async () => {
    const result = await loadSkillTool.execute({ name: "non-existent-skill" }, {
      toolCallId: "test-2",
      messages: [],
    });

    expect(result.loaded).toBe(false);
    expect(result.skillName).toBe("non-existent-skill");
    expect(result.content).toBe("");
    expect(result.error).toContain("not found");
    expect(result.error).toContain("multimodal-intake"); // Debe listar skills disponibles
  });

  it("debería cargar skill de multimodal-intake", async () => {
    const result = await loadSkillTool.execute({ name: "multimodal-intake" }, {
      toolCallId: "test-3",
      messages: [],
    });

    expect(result.loaded).toBe(true);
    expect(result.content).toContain("Multimodal Intake");
    expect(result.content).toContain("Photographs");
  });

  it("debería cargar skill de safety-flagging", async () => {
    const result = await loadSkillTool.execute({ name: "safety-flagging" }, {
      toolCallId: "test-4",
      messages: [],
    });

    expect(result.loaded).toBe(true);
    expect(result.content).toContain("STOP-FLAG");
    expect(result.content).toContain("safety");
  });

  it("debería cargar skill de qualification-gate", async () => {
    const result = await loadSkillTool.execute({ name: "qualification-gate" }, {
      toolCallId: "test-5",
      messages: [],
    });

    expect(result.loaded).toBe(true);
    expect(result.content).toContain("QUALIFICATION GATE");
    expect(result.content).toContain("six-criteria");
  });

  it("debería cargar skill de trainee-mode", async () => {
    const result = await loadSkillTool.execute({ name: "trainee-mode" }, {
      toolCallId: "test-6",
      messages: [],
    });

    expect(result.loaded).toBe(true);
    expect(result.content).toContain("Trainee Mode");
    expect(result.content).toContain("explanatory");
  });
});
