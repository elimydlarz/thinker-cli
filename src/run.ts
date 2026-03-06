import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { readProgress, writeProgress, deleteProgress } from "./progress.js";
import {
  formatManual,
  formatConfigHelp,
  formatStepList,
  formatStepBox,
  formatDirections,
  formatCallback,
  formatCompletion,
  formatError,
} from "./format.js";
import { validateOutput } from "./validate.js";
import { color } from "./color.js";
import type { Config, Progress } from "./types.js";

interface RunResult {
  output: string;
  exitCode: number;
}

export function run(args: string[]): RunResult {
  if (args.length === 0) {
    return {
      output: formatManual("<config>"),
      exitCode: 0,
    };
  }

  // Config help command
  if (args[0] === "config-help") {
    return { output: formatConfigHelp(), exitCode: 0 };
  }

  // Reset command
  if (args[0] === "reset") {
    return handleReset(args.slice(1));
  }

  const configPath = resolve(args[0]);

  // Load config
  let config: Config;
  try {
    config = loadConfig(configPath);
  } catch (e) {
    return error((e as Error).message, args[0]);
  }

  if (args.length === 1) {
    return handleStart(configPath, config, args[0]);
  }

  return handleContinue(configPath, config, args[0], args[1]);
}

function handleStart(
  configPath: string,
  config: Config,
  rawConfigPath: string
): RunResult {
  const existing = readProgress(configPath);
  if (existing) {
    const step = config.steps[existing.currentStepIndex];
    const parts: string[] = [
      color.red(
        "Error: Process already in progress. Pass output JSON to continue, or reset first."
      ),
      "",
      color.dim("─".repeat(40)),
      "",
      formatStepList(config.steps, existing.currentStepIndex),
      "",
      formatStepBox(existing.currentStepIndex, config.steps.length, step.label),
      "",
      formatDirections(step.directions, existing.sharedSpace),
      "",
      color.dim("─".repeat(40)),
      formatCallback(rawConfigPath, step.output),
      "",
      color.dim("─".repeat(40)),
      "",
      formatManual(rawConfigPath),
    ];
    return { output: parts.join("\n"), exitCode: 1 };
  }

  const progress: Progress = {
    configPath,
    currentStepIndex: 0,
    sharedSpace: {},
  };
  writeProgress(configPath, progress);

  return {
    output: formatStepOutput(config, progress, rawConfigPath),
    exitCode: 0,
  };
}

function handleContinue(
  configPath: string,
  config: Config,
  rawConfigPath: string,
  jsonArg: string
): RunResult {
  const progress = readProgress(configPath);
  if (!progress) {
    return error(
      "Process not started. Run without arguments to start.",
      rawConfigPath
    );
  }

  const step = config.steps[progress.currentStepIndex];

  const stepError = (message: string): RunResult => {
    const parts: string[] = [
      color.red(`Error: ${message}`),
      "",
      color.dim("─".repeat(40)),
      "",
      formatStepList(config.steps, progress.currentStepIndex),
      "",
      formatStepBox(progress.currentStepIndex, config.steps.length, step.label),
      "",
      formatDirections(step.directions, progress.sharedSpace),
      "",
      color.dim("─".repeat(40)),
      formatCallback(rawConfigPath, step.output),
      "",
      color.dim("─".repeat(40)),
      "",
      formatManual(rawConfigPath),
    ];
    return { output: parts.join("\n"), exitCode: 1 };
  };

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonArg);
  } catch {
    return stepError(
      `Invalid JSON: could not parse the argument.\n\nReceived: ${jsonArg}`
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return stepError("Output must be a JSON object.");
  }

  const data = parsed as Record<string, unknown>;
  const expectedKeys = Object.keys(step.output).sort();
  const actualKeys = Object.keys(data).sort();

  // Check for missing keys
  const missing = expectedKeys.filter((k) => !actualKeys.includes(k));
  if (missing.length > 0) {
    return stepError(
      `Missing output keys: ${missing.join(", ")}.\n\nExpected keys for step '${step.label}': ${expectedKeys.join(", ")}`
    );
  }

  // Check for extra keys
  const extra = actualKeys.filter((k) => !expectedKeys.includes(k));
  if (extra.length > 0) {
    return stepError(
      `Unexpected output keys: ${extra.join(", ")}.\n\nExpected keys for step '${step.label}': ${expectedKeys.join(", ")}`
    );
  }

  // Validate value types
  const typeErrors = validateOutput(data, step.output);
  if (typeErrors.length > 0) {
    return stepError(
      `Output type mismatch:\n\n${typeErrors.join("\n")}`
    );
  }

  // Merge into shared space
  for (const key of expectedKeys) {
    progress.sharedSpace[key] = data[key];
  }
  progress.currentStepIndex++;

  // Check if complete
  if (progress.currentStepIndex >= config.steps.length) {
    deleteProgress(configPath);
    return {
      output: formatCompletion(config.steps, progress.sharedSpace),
      exitCode: 0,
    };
  }

  writeProgress(configPath, progress);

  return {
    output: formatStepOutput(config, progress, rawConfigPath),
    exitCode: 0,
  };
}

function handleReset(args: string[]): RunResult {
  if (args.length === 0) {
    return error("Reset requires a config path.", "<config>");
  }

  const configPath = resolve(args[0]);
  deleteProgress(configPath);

  return {
    output: "Progress reset.",
    exitCode: 0,
  };
}

function formatStepOutput(
  config: Config,
  progress: Progress,
  rawConfigPath: string
): string {
  const step = config.steps[progress.currentStepIndex];
  const parts: string[] = [];

  parts.push(formatStepList(config.steps, progress.currentStepIndex));
  parts.push("");
  parts.push(
    formatStepBox(
      progress.currentStepIndex,
      config.steps.length,
      step.label
    )
  );
  parts.push("");
  parts.push(formatDirections(step.directions, progress.sharedSpace));
  parts.push("");
  parts.push(color.dim("─".repeat(40)));
  parts.push(formatCallback(rawConfigPath, step.output));

  return parts.join("\n");
}

function error(message: string, configPath: string): RunResult {
  return {
    output: formatError(message, configPath),
    exitCode: 1,
  };
}
