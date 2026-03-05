import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "thinker-config-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(data: unknown): string {
    const path = join(tmpDir, "config.json");
    writeFileSync(path, JSON.stringify(data));
    return path;
  }

  describe("loadConfig", () => {
    describe("given a valid config file", () => {
      it("parses steps with label, directions, and output", () => {
        const path = writeConfig({
          steps: [
            {
              label: "gather",
              directions: "List tasks.",
              output: { tasks: "Array<string>" },
            },
            {
              label: "rank",
              directions: "Rank them.",
              output: { ranked: "Array<string>" },
            },
          ],
        });

        const config = loadConfig(path);

        expect(config.steps).toHaveLength(2);
        expect(config.steps[0]).toEqual({
          label: "gather",
          directions: "List tasks.",
          output: { tasks: "Array<string>" },
        });
        expect(config.steps[1]).toEqual({
          label: "rank",
          directions: "Rank them.",
          output: { ranked: "Array<string>" },
        });
      });

      it("handles a single-step config", () => {
        const path = writeConfig({
          steps: [
            {
              label: "only",
              directions: "Do the thing.",
              output: { result: "string" },
            },
          ],
        });

        const config = loadConfig(path);

        expect(config.steps).toHaveLength(1);
      });

      it("handles output with multiple keys in one step", () => {
        const path = writeConfig({
          steps: [
            {
              label: "multi",
              directions: "Do it.",
              output: { a: "string", b: "number", c: "boolean" },
            },
          ],
        });

        const config = loadConfig(path);

        expect(Object.keys(config.steps[0].output)).toEqual(["a", "b", "c"]);
      });
    });

    describe("given an invalid config file", () => {
      describe("when file does not exist", () => {
        it("throws with a file-not-found error", () => {
          expect(() => loadConfig("/nonexistent/config.json")).toThrow(
            /not found/i
          );
        });
      });

      describe("when file is not valid JSON", () => {
        it("throws with a parse error", () => {
          const path = join(tmpDir, "bad.json");
          writeFileSync(path, "not json{{{");

          expect(() => loadConfig(path)).toThrow(/parse/i);
        });
      });

      describe("when steps array is missing", () => {
        it("throws indicating steps is required", () => {
          const path = writeConfig({});

          expect(() => loadConfig(path)).toThrow(/steps/i);
        });
      });

      describe("when steps is empty", () => {
        it("throws indicating at least one step is required", () => {
          const path = writeConfig({ steps: [] });

          expect(() => loadConfig(path)).toThrow(/at least one step/i);
        });
      });

      describe("when a step is missing label", () => {
        it("throws identifying the step index", () => {
          const path = writeConfig({
            steps: [
              { directions: "Do it.", output: { result: "string" } },
            ],
          });

          expect(() => loadConfig(path)).toThrow(/step 1.*label/i);
        });
      });

      describe("when a step is missing directions", () => {
        it("throws identifying the step index", () => {
          const path = writeConfig({
            steps: [
              { label: "step1", output: { result: "string" } },
            ],
          });

          expect(() => loadConfig(path)).toThrow(/step 1.*directions/i);
        });
      });

      describe("when a step is missing output", () => {
        it("throws identifying the step index", () => {
          const path = writeConfig({
            steps: [{ label: "step1", directions: "Do it." }],
          });

          expect(() => loadConfig(path)).toThrow(/step 1.*output/i);
        });
      });

      describe("when a step has empty output", () => {
        it("throws indicating output must have at least one key", () => {
          const path = writeConfig({
            steps: [{ label: "step1", directions: "Do it.", output: {} }],
          });

          expect(() => loadConfig(path)).toThrow(/at least one key/i);
        });
      });

      describe("when two steps declare the same output key", () => {
        it("throws identifying the duplicate key and both step labels", () => {
          const path = writeConfig({
            steps: [
              {
                label: "first",
                directions: "Do it.",
                output: { shared: "string" },
              },
              {
                label: "second",
                directions: "Do more.",
                output: { shared: "string" },
              },
            ],
          });

          expect(() => loadConfig(path)).toThrow(/shared.*first.*second/i);
        });
      });
    });
  });
});
