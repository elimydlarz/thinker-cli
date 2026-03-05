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

## Usage Example

**Config** — `prioritise-tasks.json`:
```json
{
  "steps": [
    {
      "label": "gather",
      "directions": "List all open tasks from the project board. Return them as a JSON array of { id, title, effort }."
    },
    {
      "label": "rank",
      "directions": "Here are the open tasks:\n\n{{gather}}\n\nRank them by impact-to-effort ratio. Return a JSON array sorted highest-first with { id, title, score, reasoning }."
    },
    {
      "label": "plan",
      "directions": "Here is the ranked task list:\n\n{{rank}}\n\nPick the top 3 and write a short action plan for each. Return a markdown document."
    }
  ]
}
```

**Invocation 1** — agent starts the process:
```
$ thinker prioritise-tasks.json
```
```
╭──────────────────────────────────────╮
│  STEP 1/3 — gather                   │
╰──────────────────────────────────────╯

List all open tasks from the project board. Return them as a JSON array of { id, title, effort }.

────────────────────────────────────────
To continue, run:
  thinker prioritise-tasks.json '<your result>'
```

The agent reads the board, reasons, and calls back:
```
$ thinker prioritise-tasks.json '[{"id":1,"title":"Fix login bug","effort":"S"},{"id":2,"title":"Redesign dashboard","effort":"L"},{"id":3,"title":"Add CSV export","effort":"M"}]'
```

**Invocation 2** — CLI records the gather output, shows the next step with it interpolated:
```
╭──────────────────────────────────────╮
│  STEP 2/3 — rank                     │
╰──────────────────────────────────────╯

Here are the open tasks:

┌ gather ──────────────────────────────┐
│ [{"id":1,"title":"Fix login bug",    │
│   "effort":"S"},                     │
│  {"id":2,"title":"Redesign           │
│   dashboard","effort":"L"},          │
│  {"id":3,"title":"Add CSV export",   │
│   "effort":"M"}]                     │
└──────────────────────────────────────┘

Rank them by impact-to-effort ratio. Return a JSON array sorted highest-first with { id, title, score, reasoning }.

────────────────────────────────────────
To continue, run:
  thinker prioritise-tasks.json '<your result>'
```

**Invocation 3** — agent provides ranking, gets the final step:
```
$ thinker prioritise-tasks.json '[{"id":1,...},{"id":3,...},{"id":2,...}]'
```
Output shows step 3/3 with `{{rank}}` interpolated. Agent returns the action plan.

**Final invocation:**
```
$ thinker prioritise-tasks.json '## Action Plan\n\n1. Fix login bug — ...'
```
```
╭──────────────────────────────────────╮
│  COMPLETE                            │
╰──────────────────────────────────────╯

## Action Plan

1. Fix login bug — ...

(Progress file cleaned up)
```

**Reset:**
```
$ thinker reset prioritise-tasks.json
```

## Repo Map

- `src/` — source code and tests (colocated `*.test.ts` files)
- `vitest.config.ts` — test config (verbose/tree-style reporter)
- `package.json` — project manifest; `pnpm test` runs `vitest run`

## Working in This Repo

- **Package manager:** pnpm
- **Language:** TypeScript
- **Test framework:** Vitest — run with `pnpm test`
- **Test style:** tree-shaped specs using nested `describe`/`it` blocks
