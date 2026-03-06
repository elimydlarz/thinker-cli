import { describe, it, expect } from "vitest";
import {
  formatManual,
  formatStepList,
  formatStepBox,
  formatDirections,
  formatCallback,
  formatCompletion,
  formatError,
} from "./format.js";
import type { Step } from "./types.js";

const steps: Step[] = [
  { label: "gather", directions: "List tasks.", output: { tasks: "Array<string>" } },
  { label: "rank", directions: "Rank them.", output: { ranked: "Array<string>" } },
  { label: "plan", directions: "Make a plan.", output: { actionPlan: "string" } },
];

describe("format", () => {
  describe("formatManual", () => {
    it("includes invocation syntax with the config path", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toContain("thinker my-config.json");
    });

    it("includes the continue syntax", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toContain("thinker my-config.json '<json>'");
    });

    it("includes the reset syntax", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toContain("thinker reset my-config.json");
    });

    it("explains what thinker is", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toMatch(/thought process/i);
      expect(manual).toMatch(/step/i);
    });

    it("explains the workflow", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toContain("directions");
      expect(manual).toContain("JSON");
    });

    it("explains the output contract", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toMatch(/keys/i);
      expect(manual).toMatch(/exact/i);
    });

    it("mentions the config-help command", () => {
      const manual = formatManual("my-config.json");

      expect(manual).toContain("thinker config-help");
    });
  });

  describe("formatConfigHelp", () => {
    it("explains the config file structure", () => {
      const help = formatConfigHelp();

      expect(help).toContain("steps");
      expect(help).toContain("label");
      expect(help).toContain("directions");
      expect(help).toContain("output");
    });

    it("explains interpolation with double-brace syntax", () => {
      const help = formatConfigHelp();

      expect(help).toContain("{{");
    });

    it("explains supported types", () => {
      const help = formatConfigHelp();

      expect(help).toContain("string");
      expect(help).toContain("number");
      expect(help).toContain("boolean");
      expect(help).toContain("Array");
    });

    it("includes an example config", () => {
      const help = formatConfigHelp();

      expect(help).toContain("Example");
    });

    it("explains that output keys must be unique across steps", () => {
      const help = formatConfigHelp();

      expect(help).toMatch(/unique|duplicate|collision/i);
    });
  });

  describe("formatStepList", () => {
    describe("when on step 0", () => {
      it("marks step 0 as current and the rest as future", () => {
        const list = formatStepList(steps, 0);

        expect(list).toMatch(/▶.*1\. gather/);
        expect(list).toMatch(/2\. rank/);
        expect(list).toMatch(/3\. plan/);
        expect(list).not.toContain("✓");
      });
    });

    describe("when on a middle step", () => {
      it("marks prior steps as completed, current as active, rest as future", () => {
        const list = formatStepList(steps, 1);

        expect(list).toMatch(/✓.*1\. gather/);
        expect(list).toMatch(/▶.*2\. rank/);
        expect(list).toMatch(/3\. plan/);
      });
    });

    describe("when all steps are completed", () => {
      it("marks all steps as completed", () => {
        const list = formatStepList(steps, 3);

        expect(list).toMatch(/✓.*1\. gather/);
        expect(list).toMatch(/✓.*2\. rank/);
        expect(list).toMatch(/✓.*3\. plan/);
        expect(list).not.toContain("▶");
      });
    });
  });

  describe("formatStepBox", () => {
    it("renders a box with step number, total, and label", () => {
      const box = formatStepBox(0, 3, "gather");

      expect(box).toContain("STEP 1/3");
      expect(box).toContain("gather");
    });
  });

  describe("formatDirections", () => {
    it("renders plain directions text", () => {
      const result = formatDirections("Do the thing.", {});

      expect(result).toContain("Do the thing.");
    });

    it("wraps interpolated values in a labeled box", () => {
      const result = formatDirections(
        "Here are the tasks:\n\n{{tasks}}\n\nRank them.",
        { tasks: [{ id: "1", title: "Fix bug" }] }
      );

      expect(result).toContain("tasks");
      expect(result).toContain("Fix bug");
      expect(result).toContain("Rank them.");
    });
  });

  describe("formatCallback", () => {
    it("shows the thinker command with config path and output shape", () => {
      const cb = formatCallback("my-config.json", { result: "string" });

      expect(cb).toContain("thinker my-config.json");
      expect(cb).toContain('"result"');
      expect(cb).toContain("string");
    });

    it("handles output with multiple keys", () => {
      const cb = formatCallback("c.json", { a: "string", b: "number" });

      expect(cb).toContain('"a"');
      expect(cb).toContain('"b"');
    });

    describe("when type descriptions contain single quotes", () => {
      it("replaces them with double quotes to avoid breaking the outer shell string", () => {
        const cb = formatCallback("c.json", {
          tasks: "Array<{ effort: 'S' | 'M' | 'L' }>",
        });

        expect(cb).not.toContain("'S'");
        expect(cb).not.toContain("'M'");
        expect(cb).not.toContain("'L'");
        expect(cb).toContain('"S" | "M" | "L"');
      });
    });

    describe("when type descriptions contain object keys", () => {
      it("double-quotes unquoted keys for consistency with JSON notation", () => {
        const cb = formatCallback("c.json", {
          tasks: "Array<{ id: string; title: string; effort: string }>",
        });

        expect(cb).toContain('"id":');
        expect(cb).toContain('"title":');
        expect(cb).toContain('"effort":');
      });
    });
  });

  describe("formatCompletion", () => {
    it("shows the COMPLETE box", () => {
      const result = formatCompletion(steps, { actionPlan: "Do stuff" });

      expect(result).toContain("COMPLETE");
    });

    it("shows all steps as completed", () => {
      const result = formatCompletion(steps, { actionPlan: "Do stuff" });

      expect(result).toMatch(/✓.*1\. gather/);
      expect(result).toMatch(/✓.*2\. rank/);
      expect(result).toMatch(/✓.*3\. plan/);
    });

    it("shows the final output values in labeled boxes", () => {
      const result = formatCompletion(steps, {
        tasks: ["a"],
        ranked: ["b"],
        actionPlan: "The plan",
      });

      expect(result).toContain("actionPlan");
      expect(result).toContain("The plan");
    });
  });

  describe("formatError", () => {
    it("includes the error message", () => {
      const result = formatError("Something broke", "c.json");

      expect(result).toContain("Something broke");
    });

    it("includes the CLI manual", () => {
      const result = formatError("Something broke", "c.json");

      expect(result).toContain("thinker c.json");
      expect(result).toContain("reset");
    });
  });
});
