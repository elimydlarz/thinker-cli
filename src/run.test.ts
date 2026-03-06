import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { run } from "./run.js";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { progressFilePath, readProgress } from "./progress.js";

describe("run", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "thinker-run-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(data: unknown): string {
    const path = join(tmpDir, "config.json");
    writeFileSync(path, JSON.stringify(data));
    return path;
  }

  const twoStepConfig = {
    steps: [
      {
        label: "gather",
        directions: "List tasks.",
        output: { tasks: "Array<string>" },
      },
      {
        label: "rank",
        directions: "Here are the tasks:\n\n{{tasks}}\n\nRank them.",
        output: { ranked: "Array<string>" },
      },
    ],
  };

  const threeStepConfig = {
    steps: [
      ...twoStepConfig.steps,
      {
        label: "plan",
        directions: "Ranked:\n\n{{ranked}}\n\nMake a plan.",
        output: { actionPlan: "string" },
      },
    ],
  };

  describe("start — thinker <config>", () => {
    it("creates progress file and shows step 1 directions", () => {
      const configPath = writeConfig(twoStepConfig);

      const result = run([configPath]);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("List tasks.");
      expect(readProgress(configPath)).not.toBeNull();
    });

    it("does not show the CLI manual on first invocation", () => {
      const configPath = writeConfig(twoStepConfig);

      const result = run([configPath]);

      expect(result.output).not.toContain("THINKER");
    });

    it("shows the step list with step 1 highlighted", () => {
      const configPath = writeConfig(twoStepConfig);

      const result = run([configPath]);

      expect(result.output).toMatch(/▶.*1\. gather/);
      expect(result.output).toMatch(/2\. rank/);
    });

    it("shows the callback instruction with step 1 output shape", () => {
      const configPath = writeConfig(twoStepConfig);

      const result = run([configPath]);

      expect(result.output).toContain("To continue, run:");
      expect(result.output).toContain('"tasks"');
    });

    it("fails if progress file already exists", () => {
      const configPath = writeConfig(twoStepConfig);
      run([configPath]); // start

      const result = run([configPath]); // start again

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("already in progress");
      expect(result.output).toContain("STEP 1/");
      expect(result.output).toContain(twoStepConfig.steps[0].directions);
      expect(result.output).toContain("THINKER");
    });

    it("fails if config file does not exist", () => {
      const result = run([join(tmpDir, "nonexistent.json")]);

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("not found");
    });

    it("fails if config is invalid", () => {
      const path = join(tmpDir, "bad.json");
      writeFileSync(path, "{}");

      const result = run([path]);

      expect(result.exitCode).toBe(1);
    });
  });

  describe("continue — thinker <config> '<json>'", () => {
    describe("given valid output for the current step", () => {
      it("merges output into shared space", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        run([configPath, '{"tasks": ["a", "b"]}']);

        const progress = readProgress(configPath);
        expect(progress!.sharedSpace.tasks).toEqual(["a", "b"]);
      });

      it("advances to next step and shows its directions", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"tasks": ["a", "b"]}']);

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain("Rank them.");
      });

      it("interpolates prior values into directions", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"tasks": ["a", "b"]}']);

        expect(result.output).toContain("tasks");
        // The interpolated value should appear in the output
        expect(result.output).toMatch(/\[/);
      });

      it("shows callback instruction with next step output shape", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"tasks": ["a"]}']);

        expect(result.output).toContain('"ranked"');
      });
    });

    describe("given output for the final step", () => {
      it("shows the completion output", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);
        run([configPath, '{"tasks": ["a"]}']);

        const result = run([configPath, '{"ranked": ["b"]}']);

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain("COMPLETE");
      });

      it("deletes the progress file", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);
        run([configPath, '{"tasks": ["a"]}']);

        run([configPath, '{"ranked": ["b"]}']);

        expect(existsSync(progressFilePath(configPath))).toBe(false);
      });
    });

    describe("validation errors", () => {
      it("fails if no progress file exists", () => {
        const configPath = writeConfig(twoStepConfig);

        const result = run([configPath, '{"tasks": ["a"]}']);

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("not started");
      });

      it("fails if JSON is malformed", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, "not-json"]);

        expect(result.exitCode).toBe(1);
      });

      it("fails if JSON keys do not match step output declaration", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"wrong": "key"}']);

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("tasks");
      });

      it("fails if JSON has extra keys", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([
          configPath,
          '{"tasks": ["a"], "extra": "key"}',
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("extra");
      });

      it("fails if a value does not match the declared type", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"tasks": "not an array"}']);

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("expected array");
      });

      it("fails if JSON is missing keys", () => {
        const configPath = writeConfig(threeStepConfig);
        // Use a step with multiple output keys by creating a custom config
        const multiKeyConfig = {
          steps: [
            {
              label: "step1",
              directions: "Do it.",
              output: { a: "string", b: "string" },
            },
          ],
        };
        const multiPath = join(tmpDir, "multi.json");
        writeFileSync(multiPath, JSON.stringify(multiKeyConfig));
        run([multiPath]);

        const result = run([multiPath, '{"a": "val"}']);

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("b");
      });
    });

    describe("error output", () => {
      it("shows what went wrong and how to retry", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"wrong": "key"}']);

        expect(result.output).toContain("Error");
        expect(result.output).toContain("tasks");
      });

      it("shows the CLI manual on step validation error", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"wrong": "key"}']);

        expect(result.output).toContain("THINKER");
      });

      it("repeats step directions on validation error", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"wrong": "key"}']);

        expect(result.output).toContain("List tasks.");
      });

      it("repeats callback instruction on validation error", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"wrong": "key"}']);

        expect(result.output).toContain("To continue, run:");
        expect(result.output).toContain('"tasks": Array<string>');
      });

      it("shows step list on validation error", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, '{"wrong": "key"}']);

        expect(result.output).toMatch(/▶.*1\. gather/);
      });

      it("repeats step directions on malformed JSON", () => {
        const configPath = writeConfig(twoStepConfig);
        run([configPath]);

        const result = run([configPath, "not-json"]);

        expect(result.output).toContain("List tasks.");
        expect(result.output).toContain("To continue, run:");
      });
    });
  });

  describe("reset — thinker reset <config>", () => {
    it("deletes the progress file", () => {
      const configPath = writeConfig(twoStepConfig);
      run([configPath]);

      const result = run(["reset", configPath]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(progressFilePath(configPath))).toBe(false);
    });

    it("succeeds even if no progress file exists", () => {
      const configPath = writeConfig(twoStepConfig);

      const result = run(["reset", configPath]);

      expect(result.exitCode).toBe(0);
    });
  });

  describe("no arguments", () => {
    it("shows manual without error", () => {
      const result = run([]);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("THINKER");
      expect(result.output).not.toContain("Error:");
    });
  });

  describe("config-help — thinker config-help", () => {
    it("shows config writing instructions", () => {
      const result = run(["config-help"]);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("steps");
      expect(result.output).toContain("label");
      expect(result.output).toContain("directions");
      expect(result.output).toContain("output");
    });

    it("does not show the standard manual", () => {
      const result = run(["config-help"]);

      expect(result.output).not.toContain("THINKER");
    });
  });
});
