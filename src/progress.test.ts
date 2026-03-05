import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  progressFilePath,
  readProgress,
  writeProgress,
  deleteProgress,
} from "./progress.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

describe("progress", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "thinker-progress-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("progressFilePath", () => {
    it("returns a deterministic path based on config path", () => {
      const configPath = join(tmpDir, "config.json");
      const a = progressFilePath(configPath);
      const b = progressFilePath(configPath);

      expect(a).toBe(b);
    });

    it("returns different paths for different config paths", () => {
      const a = progressFilePath(join(tmpDir, "a.json"));
      const b = progressFilePath(join(tmpDir, "b.json"));

      expect(a).not.toBe(b);
    });

    it("places the progress file alongside the config file", () => {
      const configPath = join(tmpDir, "config.json");
      const progPath = progressFilePath(configPath);

      expect(dirname(progPath)).toBe(dirname(configPath));
    });
  });

  describe("readProgress", () => {
    describe("when no progress file exists", () => {
      it("returns null", () => {
        const configPath = join(tmpDir, "config.json");

        expect(readProgress(configPath)).toBeNull();
      });
    });

    describe("when progress file exists", () => {
      it("returns the parsed progress object", () => {
        const configPath = join(tmpDir, "config.json");
        const progress = {
          configPath,
          currentStepIndex: 1,
          sharedSpace: { tasks: ["a", "b"] },
        };
        writeFileSync(progressFilePath(configPath), JSON.stringify(progress));

        const result = readProgress(configPath);

        expect(result).toEqual(progress);
      });
    });
  });

  describe("writeProgress", () => {
    it("creates a new progress file", () => {
      const configPath = join(tmpDir, "config.json");
      const progress = {
        configPath,
        currentStepIndex: 0,
        sharedSpace: {},
      };

      writeProgress(configPath, progress);

      expect(readProgress(configPath)).toEqual(progress);
    });

    it("overwrites an existing progress file", () => {
      const configPath = join(tmpDir, "config.json");
      writeProgress(configPath, {
        configPath,
        currentStepIndex: 0,
        sharedSpace: {},
      });

      const updated = {
        configPath,
        currentStepIndex: 1,
        sharedSpace: { tasks: ["x"] },
      };
      writeProgress(configPath, updated);

      expect(readProgress(configPath)).toEqual(updated);
    });
  });

  describe("deleteProgress", () => {
    it("removes the progress file", () => {
      const configPath = join(tmpDir, "config.json");
      writeProgress(configPath, {
        configPath,
        currentStepIndex: 0,
        sharedSpace: {},
      });

      deleteProgress(configPath);

      expect(readProgress(configPath)).toBeNull();
    });

    describe("when no progress file exists", () => {
      it("does not throw", () => {
        const configPath = join(tmpDir, "config.json");

        expect(() => deleteProgress(configPath)).not.toThrow();
      });
    });
  });
});
