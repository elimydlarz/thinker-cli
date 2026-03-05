import type { Step, SharedSpace } from "./types.js";
import { interpolate } from "./interpolate.js";

const BOX_WIDTH = 40;

function labeledBox(label: string, content: string): string {
  const inner = BOX_WIDTH - 4;
  const lines: string[] = [];
  // Wrap content to fit inside the box
  const rawLines = content.split("\n");
  for (const line of rawLines) {
    if (line.length <= inner) {
      lines.push(line);
    } else {
      // Word-wrap long lines
      let remaining = line;
      while (remaining.length > inner) {
        let breakAt = remaining.lastIndexOf(" ", inner);
        if (breakAt <= 0) breakAt = inner;
        lines.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt).trimStart();
      }
      if (remaining) lines.push(remaining);
    }
  }

  const top = `┌ ${label} ${"─".repeat(Math.max(0, inner - label.length - 1))}┐`;
  const bottom = `└${"─".repeat(inner + 2)}┘`;
  const body = lines.map((l) => `│ ${l.padEnd(inner)} │`).join("\n");
  return `${top}\n${body}\n${bottom}`;
}

function headerBox(title: string): string {
  const inner = BOX_WIDTH - 2;
  const padded = `  ${title}`;
  return [
    `╭${"─".repeat(inner)}╮`,
    `│${padded.padEnd(inner)}│`,
    `╰${"─".repeat(inner)}╯`,
  ].join("\n");
}

export function formatManual(configPath: string): string {
  return [
    "Usage:",
    "",
    `  Start:    thinker ${configPath}`,
    `  Continue: thinker ${configPath} '<json>'`,
    `  Reset:    thinker reset ${configPath}`,
  ].join("\n");
}

export function formatStepList(steps: Step[], currentIndex: number): string {
  const lines = steps.map((step, i) => {
    const num = i + 1;
    if (i < currentIndex) return `  ✓ ${num}. ${step.label}`;
    if (i === currentIndex) return `  ▶ ${num}. ${step.label}`;
    return `    ${num}. ${step.label}`;
  });
  return `Steps:\n${lines.join("\n")}`;
}

export function formatStepBox(
  stepIndex: number,
  totalSteps: number,
  label: string
): string {
  return headerBox(`STEP ${stepIndex + 1}/${totalSteps} — ${label}`);
}

export function formatDirections(
  directions: string,
  sharedSpace: SharedSpace
): string {
  // Build replacements where each value is rendered as a labeled box
  const boxReplacements: SharedSpace = {};
  for (const [key, value] of Object.entries(sharedSpace)) {
    const stringVal = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    boxReplacements[key] = `\n${labeledBox(key, stringVal)}\n`;
  }

  return interpolate(directions, boxReplacements);
}

export function formatCallback(
  configPath: string,
  output: Record<string, string>
): string {
  const entries = Object.entries(output)
    .map(([key, type]) => `    "${key}": ${type}`)
    .join(",\n");

  return [
    "To continue, run:",
    "",
    `  thinker ${configPath} '{`,
    entries,
    `  }'`,
  ].join("\n");
}

export function formatCompletion(
  steps: Step[],
  sharedSpace: SharedSpace
): string {
  const parts: string[] = [];
  parts.push(headerBox("COMPLETE"));
  parts.push("");
  parts.push(formatStepList(steps, steps.length));
  parts.push("");
  parts.push("Final output:");

  // Show the last step's output keys
  const lastStep = steps[steps.length - 1];
  for (const key of Object.keys(lastStep.output)) {
    if (key in sharedSpace) {
      const val = sharedSpace[key];
      const stringVal = typeof val === "string" ? val : JSON.stringify(val, null, 2);
      parts.push("");
      parts.push(labeledBox(key, stringVal));
    }
  }

  parts.push("");
  parts.push("(Progress file cleaned up)");

  return parts.join("\n");
}

export function formatError(message: string, configPath: string): string {
  return [
    `Error: ${message}`,
    "",
    "─".repeat(BOX_WIDTH),
    "",
    formatManual(configPath),
  ].join("\n");
}
