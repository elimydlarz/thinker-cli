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

- **Config** — a JSON file defining an ordered list of steps. Each step has a `label`, `directions`, and an `output` declaration (a map of key names to TypeScript-style type descriptions). Directions are verbal/descriptive — the agent reads them as text.
- **Shared space** — a flat namespace of all accumulated output properties from completed steps. Each step's `output` keys merge into this space. Keys are immutable — once set, they never change. Later steps reference these values via `{{key}}` interpolation in their directions.
- **Output declaration** — each step declares the JSON keys the agent must provide to advance. This serves double duty: it's the contract the agent must fulfil, and the template for the "call me back with..." instruction the CLI prints. Types use TypeScript notation (e.g. `"string"`, `"Array<{ id: string; title: string }>"`, `"number"`).
- **Progress file** — persisted to disk, keyed to the config file. Tracks current step index and the shared space. This is the only state.
- **Invocation loop** — each step forward-directs the next. The CLI shows directions (with shared space values interpolated), then tells the agent exactly how to call back with the required output shape. The agent reasons, acts, and invokes the CLI with a JSON object matching the declared output.
- **Lifecycle**: no progress file → `thinker config.json` starts at step 0 (no args). Progress file exists → `thinker config.json '{"key": value}'` continues, providing the current step's output. `thinker reset config.json` → deletes progress file.

**What the CLI does NOT do:** run inference or manage conversation history. The agent owns all reasoning and memory.

## Requirements

- **start** — `thinker <config-path>` with no args starts the process at step 0. Fails if a progress file already exists (agent must reset first or continue with args).
- **continue** — `thinker <config-path> '<json>'` advances the process. The JSON must be an object whose keys match the current step's declared `output`. The CLI merges those keys into the shared space, advances to the next step, and emits its directions.
- **complete** — when all steps are done, emit the final result and clean up the progress file.
- **reset** — `thinker reset <config-path>` deletes the progress file, allowing a fresh start.
- **config-format** — JSON file with an ordered list of steps. Each step has `label` (string), `directions` (string), and `output` (map of key names to TypeScript-style type descriptions, e.g. `{ "tasks": "Array<{ id: string; title: string }>" }`).
- **config-validation** — at load time, reject configs where two steps declare the same output key. Variables are immutable — no collisions allowed.
- **progress-tracking** — progress is saved to disk, keyed to the config file path. Stores current step index and the shared space (all accumulated output key-value pairs).
- **output-format** — CLI output is nicely formatted text. Shows progress (e.g. step 2/5), highlights the current step, clearly demarcates interpolated values from prior steps, and tells the agent exactly how to call back including the required JSON shape derived from the step's `output` declaration.
- **directions-interpolation** — directions can reference `{{key}}` where `key` is any property in the shared space from a prior step's output.

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
