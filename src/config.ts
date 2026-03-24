import { readFileSync, existsSync } from "node:fs";
import type { Config, Step } from "./types.js";

export function resolveConfigPath(configPath: string): string {
  if (existsSync(configPath)) return configPath;
  const withExt = configPath + ".json";
  if (existsSync(withExt)) return withExt;
  throw new Error(`Config file not found: ${configPath}`);
}

export function loadConfig(configPath: string): Config {
  const resolvedPath = resolveConfigPath(configPath);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolvedPath, "utf-8"));
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Failed to parse config file: ${e.message}`);
    }
    throw e;
  }

  if (typeof raw !== "object" || raw === null || !("steps" in raw)) {
    throw new Error("Config must have a 'steps' array.");
  }

  const { steps } = raw as { steps: unknown };

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Config must have at least one step.");
  }

  const validatedSteps: Step[] = [];
  const outputKeys = new Map<string, string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const num = i + 1;

    if (typeof step !== "object" || step === null) {
      throw new Error(`Step ${num} must be an object.`);
    }

    const s = step as Record<string, unknown>;

    if (typeof s.label !== "string") {
      throw new Error(`Step ${num} is missing a 'label' (string).`);
    }
    if (typeof s.directions !== "string") {
      throw new Error(`Step ${num} is missing 'directions' (string).`);
    }
    if (typeof s.output !== "object" || s.output === null) {
      throw new Error(`Step ${num} is missing 'output' (object).`);
    }

    const output = s.output as Record<string, unknown>;
    const keys = Object.keys(output);

    if (keys.length === 0) {
      throw new Error(
        `Step ${num} ('${s.label}') output must have at least one key.`
      );
    }

    for (const key of keys) {
      const existingLabel = outputKeys.get(key);
      if (existingLabel !== undefined) {
        throw new Error(
          `Duplicate output key '${key}' declared in '${existingLabel}' and '${s.label}'.`
        );
      }
      outputKeys.set(key, s.label as string);
    }

    const typedOutput: Record<string, string> = {};
    for (const key of keys) {
      typedOutput[key] = String(output[key]);
    }

    validatedSteps.push({
      label: s.label as string,
      directions: s.directions as string,
      output: typedOutput,
    });
  }

  return { steps: validatedSteps };
}
