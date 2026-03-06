import type { Step, SharedSpace } from "./types.js";
import { interpolate } from "./interpolate.js";
import { color } from "./color.js";

const BOX_WIDTH = 40;

const ANSI_RE = /\x1b\[\d+m/g;
function visibleLength(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

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

  const top = color.dim(`┌ ${label} ${"─".repeat(Math.max(0, inner - label.length))}┐`);
  const bottom = color.dim(`└${"─".repeat(inner + 2)}┘`);
  const body = lines.map((l) => `${color.dim("│")} ${l.padEnd(inner)} ${color.dim("│")}`).join("\n");
  return `${top}\n${body}\n${bottom}`;
}

function headerBox(title: string): string {
  const inner = BOX_WIDTH - 2;
  const padded = `  ${title}`;
  const pad = inner - visibleLength(padded);
  return [
    color.dim(`╭${"─".repeat(inner)}╮`),
    color.dim("│") + padded + " ".repeat(Math.max(0, pad)) + color.dim("│"),
    color.dim(`╰${"─".repeat(inner)}╯`),
  ].join("\n");
}

export function formatManual(configPath: string): string {
  return [
    headerBox(color.bold("THINKER")),
    "",
    color.dim("  Guided thought process CLI"),
    color.dim("  Walks you through a multi-step thought process"),
    color.dim("  defined in a config file. Each step gives you"),
    color.dim("  directions and tells you how to call back."),
    "",
    `  ${color.cyan("Workflow")}`,
    `  ${color.dim("1.")} Run thinker with a config to see step 1.`,
    `  ${color.dim("2.")} Read the directions and do the work.`,
    `  ${color.dim("3.")} Call back with a JSON object containing`,
    `     your output.`,
    `  ${color.dim("4.")} Thinker validates, saves, and shows the`,
    `     next step — with prior outputs interpolated.`,
    `  ${color.dim("5.")} Repeat until all steps are complete.`,
    "",
    `  ${color.cyan("Output contract")}`,
    `  Each step declares the exact keys you must return.`,
    `  Your JSON must have those keys — no extra, no missing.`,
    `  The type descriptions tell you the expected shape.`,
    "",
    `  ${color.cyan("Commands")}`,
    "",
    `  ${color.green(`thinker ${configPath}`)}`,
    color.dim("    Start the process at step 1."),
    "",
    `  ${color.green(`thinker ${configPath} '<json>'`)}`,
    color.dim("    Submit output for the current step and advance."),
    "",
    `  ${color.yellow(`thinker reset ${configPath}`)}`,
    color.dim("    Discard progress and start over."),
  ].join("\n");
}

export function formatStepList(steps: Step[], currentIndex: number): string {
  const lines = steps.map((step, i) => {
    const num = i + 1;
    if (i < currentIndex) return color.green(`  ✓ ${num}. ${step.label}`);
    if (i === currentIndex) return color.blue(`  ▶ ${num}. ${step.label}`);
    return color.dim(`    ${num}. ${step.label}`);
  });
  return `Steps:\n${lines.join("\n")}`;
}

export function formatStepBox(
  stepIndex: number,
  totalSteps: number,
  label: string
): string {
  return headerBox(color.blue(`STEP ${stepIndex + 1}/${totalSteps} — ${label}`));
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
    .map(([key, type]) => {
      const quoted = type
        .replace(/'/g, '"')
        .replace(/([{;])\s*(\w+)\s*:/g, '$1 "$2":');
      return `    "${key}": ${quoted}`;
    })
    .join(",\n");

  return [
    color.dim("To continue, run:"),
    "",
    `  ${color.green(`thinker ${configPath}`)} '${color.dim("{")}`,
    entries,
    `  ${color.dim("}")}'`,
  ].join("\n");
}

export function formatCompletion(
  steps: Step[],
  sharedSpace: SharedSpace
): string {
  const parts: string[] = [];
  parts.push(headerBox(color.green("COMPLETE")));
  parts.push("");
  parts.push(formatStepList(steps, steps.length));
  parts.push("");
  parts.push(color.bold("Final output:"));

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
  parts.push(color.dim("(Progress file cleaned up)"));

  return parts.join("\n");
}

export function formatError(message: string, configPath: string): string {
  return [
    color.red(`Error: ${message}`),
    "",
    color.dim("─".repeat(BOX_WIDTH)),
    "",
    formatManual(configPath),
  ].join("\n");
}
