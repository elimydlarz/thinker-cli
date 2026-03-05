# Thinker CLI

Thinker CLI is a stateless orchestrator that guides an external AI agent through a multi-step thought process. Instead of running inference itself, it:

1. Takes a config defining a sequence of steps (each with directions)
2. On each invocation, prompts the agent with what to do next and how to invoke the CLI again with its result
3. The agent reasons, acts, then calls the CLI again with its output — advancing the state machine
4. This loops until all steps are complete, at which point the final result is returned

The agent replaces LLM inference, and the CLI replaces orchestration logic. The agent just follows the CLI's instructions until it gets a terminal result.

This is inspired by an internal library (see `think` function in the original codebase) that recursively iterates through preconfigured thought process steps using Google GenAI — but "unrolled" across multiple CLI invocations so any agent can drive the process.

## Mental Model

Thinker CLI is a **state machine driver**. A "thought process" is a config file defining ordered steps. The CLI persists progress to disk between invocations and emits formatted text instructions for the agent each time it's called.

**Key concepts:**

- **Config** — a JSON file defining an ordered list of steps. Each step has a `label`, `directions`, and an `output` declaration (a map of key names to TypeScript-style type descriptions). Directions are verbal/descriptive — the agent reads them as text.
- **Shared space** — a flat namespace of all accumulated output properties from completed steps. Each step's `output` keys merge into this space. Keys are immutable — once set, they never change. Later steps reference these values via `{{key}}` interpolation in their directions.
- **Output declaration** — each step declares the JSON keys the agent must provide to advance. This serves double duty: it's the contract the agent must fulfil, and the template for the "call me back with..." instruction the CLI prints. Types use TypeScript notation (e.g. `"string"`, `"Array<{ id: string; title: string }>"`, `"number"`).
- **Progress file** — persisted to disk, keyed to the config file. Tracks current step index and the shared space. This is the only state.
- **Invocation loop** — each step forward-directs the next. The CLI shows directions (with shared space values interpolated), then tells the agent exactly how to call back with the required output shape. The agent reasons, acts, and invokes the CLI with a JSON object matching the declared output.
- **Lifecycle**: no progress file → `thinker config.json` starts at step 0 (no args). Progress file exists → `thinker config.json '{"key": value}'` continues, providing the current step's output. `thinker reset config.json` → deletes progress file.

**Agent-first design:** This is a CLI built for AI agents, not humans. Every interaction is optimised for agent success:
- **Fail fast** — validate everything on input (args shape, output keys, JSON parse, config structure). Never proceed with bad state.
- **Helpful errors** — every error message explains exactly what went wrong, what was expected, and how to retry correctly.
- **Show the manual** — on first invocation and on any error, print the CLI user manual (invocation syntax, args format, reset command). This is about how to use the tool, not the thought process content.
- **Step isolation** — only ever show the current step's directions. Never reveal past or future step content — this prevents agents from skipping ahead or biasing their reasoning toward later steps.

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
- **agent-first-errors** — validate all input strictly (JSON parsing, expected output keys, no extra keys, config structure). On failure: explain what went wrong, show what was expected, and tell the agent exactly how to retry. Include the full user manual on first invocation and on any error.
- **agent-first-manual** — a CLI usage guide printed at step 0 and on errors. Covers: invocation syntax, how to pass args, how to reset. Does NOT reveal step content — only how to operate the tool.
- **step-isolation** — only the current step's directions and output shape are shown. Past and future steps are never revealed. This is critical for effective chain-of-thought — agents will try to skip ahead if they can see what's coming.

## Usage Example

**Config** — `prioritise-tasks.json`:
```json
{
  "steps": [
    {
      "label": "gather",
      "directions": "List all open tasks from the project board.",
      "output": {
        "tasks": "Array<{ id: string; title: string; effort: 'S' | 'M' | 'L' }>"
      }
    },
    {
      "label": "rank",
      "directions": "Here are the open tasks:\n\n{{tasks}}\n\nRank them by impact-to-effort ratio, highest first.",
      "output": {
        "ranked": "Array<{ id: string; title: string; score: number; reasoning: string }>"
      }
    },
    {
      "label": "plan",
      "directions": "Here is the ranked task list:\n\n{{ranked}}\n\nPick the top 3 and write a short action plan for each.",
      "output": {
        "actionPlan": "string"
      }
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

List all open tasks from the project board.

────────────────────────────────────────
To continue, run:

  thinker prioritise-tasks.json '{
    "tasks": Array<{ id: string; title: string; effort: 'S' | 'M' | 'L' }>
  }'
```

The agent reads the board, reasons, and calls back:
```
$ thinker prioritise-tasks.json '{ "tasks": [{"id":"1","title":"Fix login bug","effort":"S"},{"id":"2","title":"Redesign dashboard","effort":"L"},{"id":"3","title":"Add CSV export","effort":"M"}] }'
```

**Invocation 2** — CLI merges `tasks` into shared space, shows next step with it interpolated:
```
╭──────────────────────────────────────╮
│  STEP 2/3 — rank                     │
╰──────────────────────────────────────╯

Here are the open tasks:

┌ tasks ───────────────────────────────┐
│ [{"id":"1","title":"Fix login bug",  │
│   "effort":"S"},                     │
│  {"id":"2","title":"Redesign         │
│   dashboard","effort":"L"},          │
│  {"id":"3","title":"Add CSV export", │
│   "effort":"M"}]                     │
└──────────────────────────────────────┘

Rank them by impact-to-effort ratio, highest first.

────────────────────────────────────────
To continue, run:

  thinker prioritise-tasks.json '{
    "ranked": Array<{ id: string; title: string; score: number; reasoning: string }>
  }'
```

**Invocation 3** — agent provides ranking, gets the final step with `{{ranked}}` interpolated. Agent returns the action plan.

**Final invocation:**
```
$ thinker prioritise-tasks.json '{ "actionPlan": "## Action Plan\n\n1. Fix login bug — ..." }'
```
```
╭──────────────────────────────────────╮
│  COMPLETE                            │
╰──────────────────────────────────────╯

Final output:

┌ actionPlan ──────────────────────────┐
│ ## Action Plan                       │
│                                      │
│ 1. Fix login bug — ...               │
└──────────────────────────────────────┘

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
