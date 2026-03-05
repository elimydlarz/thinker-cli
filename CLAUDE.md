# Thinker CLI

Thinker CLI is a stateless orchestrator that guides an external AI agent through a multi-step thought process. Instead of running inference itself, it:

1. Takes a config defining a sequence of steps (each with directions)
2. On each invocation, prompts the agent with what to do next and how to invoke the CLI again with its result
3. The agent reasons, acts, then calls the CLI again with its output — advancing the state machine
4. This loops until all steps are complete, at which point the final result is returned

The agent replaces LLM inference, and the CLI replaces orchestration logic. The agent just follows the CLI's instructions until it gets a terminal result.

This is inspired by an internal library (see `think` function in the original codebase) that recursively iterates through preconfigured thought process steps using Google GenAI — but "unrolled" across multiple CLI invocations so any agent can drive the process.

## Mental Model

Thinker CLI is a **stateless state machine driver**. A "thought process" is a config file defining ordered steps. The CLI tracks progress on disk and emits formatted text instructions for the agent on each invocation.

**Key concepts:**

- **Config** (`thoughts.json`) — a JSON file defining an ordered list of steps, each with a label and directions. Directions are verbal/descriptive — no schemas, since different agents work differently.
- **Progress file** — persisted to disk, keyed to the config file. Tracks which step the agent is on and the accumulated outputs from prior steps. This is the only state.
- **Invocation loop** — the agent calls `thinker <config> [args]`. The CLI reads the progress file, records the agent's input, advances the step, and emits the next step's instructions (or the final result). The agent reads the output, reasons, acts, and calls back.
- **Lifecycle**: no progress file → start at step 0. Progress file exists → continue from current step. `thinker reset <config>` → delete progress file.

**What the CLI does NOT do:** run inference, validate output schemas, or manage conversation history. The agent owns all reasoning and memory. Configs can ask the agent to do things like "search memory before answering" — that's up to the config author.

## Requirements

- **invoke** — `thinker <config-path> '<json-args>'` advances the thought process. Reads progress file, records args from the agent, moves to the next step, and emits formatted instructions for the current step.
- **start** — if no progress file exists for a config, the first invocation starts the process at step 0.
- **continue** — if a progress file exists, the invocation continues from the current step, incorporating the agent's provided args as the output of the previous step.
- **complete** — when all steps are done, emit the final result and clean up the progress file.
- **reset** — `thinker reset <config-path>` deletes the progress file, allowing a fresh start.
- **config-format** — config is a JSON file at a given path. Defines an ordered list of steps, each with at minimum `label` and `directions`.
- **progress-tracking** — progress is saved to disk, keyed to the config file path. Stores current step index and accumulated step outputs.
- **output-format** — CLI output is nicely formatted text. Shows progress (e.g. step 2/5), highlights the current step, clearly demarcates interpolated variables from prior steps, and tells the agent exactly how to call back.
- **no-schema-validation** — step outputs are freeform (string or JSON). The CLI does not validate structure — it's agent-first and flexible.
- **directions-interpolation** — directions can reference outputs from prior steps so configs can build on earlier reasoning.

## Repo Map

- `src/` — source code and tests (colocated `*.test.ts` files)
- `vitest.config.ts` — test config (verbose/tree-style reporter)
- `package.json` — project manifest; `pnpm test` runs `vitest run`

## Working in This Repo

- **Package manager:** pnpm
- **Language:** TypeScript
- **Test framework:** Vitest — run with `pnpm test`
- **Test style:** tree-shaped specs using nested `describe`/`it` blocks
