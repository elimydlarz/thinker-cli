# Thinker CLI

Thinker CLI is an orchestrator that guides an AI agent through a multi-step thought process. It owns the plan; the agent owns the reasoning and memory. The CLI persists state to disk between invocations, and on each call it tells the agent what to think about next and exactly how to call back with its answer. The agent reasons, acts, calls back, and the CLI advances the state machine — step by step until the process completes.

This is inspired by an internal library that recursively iterates through preconfigured thought process steps using Google GenAI — but "unrolled" across multiple CLI invocations so any agent can drive the process.

## Mental Model

### Core domain

- **Config** — a JSON file defining an ordered sequence of steps. This is the thought process blueprint. It is read-only at runtime.
- **Step** — a single unit of work in a thought process. Has a `label` (human-readable name), `directions` (what the agent should do, as prose), and `output` (a declaration of the named variables the agent must return, with TypeScript-style type descriptions).
- **Shared space** — a flat, append-only namespace of variables accumulated across steps. Each step's `output` keys merge into the shared space when the agent provides them. Keys are immutable — once set, they never change. No two steps may declare the same key (enforced at config load time).
- **Progress file** — the on-disk state for an in-flight thought process, keyed to the config file path. Contains the current step index and the shared space. This is how the CLI remembers where the agent is between invocations.

### Operating principles

- **Forward-directing** — each invocation tells the agent what to do and exactly how to call back. The output declaration serves double duty: it's the contract the agent must fulfil, and the template for the callback instruction.
- **Step isolation** — the agent sees all step labels (with the current one highlighted and completed ones marked) so it understands the overall plan and its place in it. It sees the current step's directions and output shape, and values from prior steps interpolated into the directions. It never sees other steps' directions or future steps' output shapes. This prevents agents from skipping ahead — they will try.
- **Agent-first** — this CLI is built for AI agents, not humans. It validates everything on input and fails fast with errors that explain what went wrong, what was expected, and how to retry. On first invocation and on any error, it prints the full CLI user manual (invocation syntax, args format, reset command) — not the thought process content, just how to operate the tool. Agents learn fast when given complete context at the right moments.
- **Interpolation** — directions can contain `{{key}}` placeholders that are replaced with the corresponding value from the shared space. This is how later steps build on earlier reasoning.

### Lifecycle

1. `thinker config.json` — no progress file exists, so the CLI starts at step 0 (no args). Prints the user manual, the step list, and the first step's directions + output shape.
2. `thinker config.json '{"key": value}'` — progress file exists. The CLI validates the JSON keys match the current step's output declaration, merges them into the shared space, saves progress, advances to the next step, and prints that step's directions (with interpolated values) + output shape.
3. Repeat until all steps are complete.
4. On the final invocation, the CLI emits the completed result and cleans up the progress file.
5. `thinker reset config.json` — deletes the progress file at any point, allowing a fresh start.

## Requirements

### Functional

- **start** — `thinker <config-path>` with no args starts the process at step 0. Fails if a progress file already exists (agent must reset or continue with args).
- **continue** — `thinker <config-path> '<json>'` advances the process. The JSON must be an object whose keys match the current step's declared `output`. The CLI merges those keys into the shared space, advances to the next step, and emits its directions.
- **complete** — when all steps are done, emit the final result and clean up the progress file.
- **reset** — `thinker reset <config-path>` deletes the progress file, allowing a fresh start.
- **config-format** — JSON file with an ordered list of steps. Each step has `label` (string), `directions` (string), and `output` (map of key names to TypeScript-style type descriptions, e.g. `{ "tasks": "Array<{ id: string; title: string }>" }`).
- **config-validation** — at load time, reject configs where two steps declare the same output key. Variables are immutable — no collisions allowed.
- **progress-tracking** — progress is saved to disk, keyed to the config file path. Stores current step index and the shared space (all accumulated output key-value pairs).
- **directions-interpolation** — directions can contain `{{key}}` placeholders. The CLI replaces them with the corresponding value from the shared space before displaying.

### Cross-functional

- **output-format** — CLI output is nicely formatted text. Shows the step list (completed/current/future), the current step's directions with interpolated values visually demarcated, and the exact callback command with the required JSON shape. Type descriptions in the callback command use double quotes internally (single quotes are replaced) so they don't break the outer single-quoted shell string. Object keys inside type descriptions are also double-quoted (e.g. `Array<{ "id": string }>` not `Array<{ id: string }>`) for consistency with JSON notation.
- **step-isolation** — show all step labels (completed marked, current highlighted, future listed). Show the current step's directions + output shape + interpolated prior values. Never reveal other steps' directions or future output shapes.
- **agent-first-errors** — validate all input strictly (JSON parsing, expected output keys, config structure). On failure: explain what went wrong, show what was expected, tell the agent exactly how to retry, and reprint the CLI user manual. For step-related errors (bad JSON, wrong keys), also repeat the current step's full instructions (step list, directions, callback command) so the agent can retry without a separate invocation.
- **agent-first-manual** — a full orientation guide printed at step 0 and on usage errors (no args, not started, already in progress, bad config). Not printed on step validation errors (bad JSON, wrong keys) — those repeat the step instructions instead. Explains what thinker is (a guided thought process CLI), the workflow (directions → work → callback → next step), the output contract (exact keys, no extra, no missing), and all commands (start, continue, reset).

## Usage Example

See `examples/prioritise-tasks.json` for a ready-to-run sample config. Try it:

```
$ thinker examples/prioritise-tasks.json
```
```
Steps:
  ▶ 1. gather
    2. rank
    3. plan

╭──────────────────────────────────────╮
│  STEP 1/3 — gather                   │
╰──────────────────────────────────────╯

List all open tasks from the project board.

────────────────────────────────────────
To continue, run:

  thinker prioritise-tasks.json '{
    "tasks": Array<{ id: string; title: string; effort: "S" | "M" | "L" }>
  }'
```

The agent reads the board, reasons, and calls back:
```
$ thinker prioritise-tasks.json '{ "tasks": [{"id":"1","title":"Fix login bug","effort":"S"},{"id":"2","title":"Redesign dashboard","effort":"L"},{"id":"3","title":"Add CSV export","effort":"M"}] }'
```

**Invocation 2** — CLI merges `tasks` into shared space, shows next step with it interpolated:
```
Steps:
  ✓ 1. gather
  ▶ 2. rank
    3. plan

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

**Invocation 3** — CLI merges `ranked` into shared space, shows final step:
```
$ thinker prioritise-tasks.json '{ "ranked": [{"id":"1","title":"Fix login bug","score":9,"reasoning":"High impact, low effort"},{"id":"3","title":"Add CSV export","score":5,"reasoning":"Medium impact and effort"},{"id":"2","title":"Redesign dashboard","score":2,"reasoning":"High impact but very high effort"}] }'
```
```
Steps:
  ✓ 1. gather
  ✓ 2. rank
  ▶ 3. plan

╭──────────────────────────────────────╮
│  STEP 3/3 — plan                     │
╰──────────────────────────────────────╯

Here is the ranked task list:

┌ ranked ──────────────────────────────┐
│ [{"id":"1","title":"Fix login bug",  │
│   "score":9,"reasoning":"High        │
│   impact, low effort"},              │
│  {"id":"3","title":"Add CSV export", │
│   "score":5,"reasoning":"Medium      │
│   impact and effort"},               │
│  {"id":"2","title":"Redesign         │
│   dashboard","score":2,              │
│   "reasoning":"High impact but very  │
│   high effort"}]                     │
└──────────────────────────────────────┘

Pick the top 3 and write a short action plan for each.

────────────────────────────────────────
To continue, run:

  thinker prioritise-tasks.json '{
    "actionPlan": string
  }'
```

**Invocation 4** — agent provides the final output, process completes:
```
$ thinker prioritise-tasks.json '{ "actionPlan": "## Action Plan\n\n1. **Fix login bug** — Reproduce with test account, patch session handler, add regression test.\n2. **Add CSV export** — Add export button to list views, stream rows to avoid memory issues.\n3. **Redesign dashboard** — Start with wireframes, get stakeholder sign-off before dev." }'
```
```
╭──────────────────────────────────────╮
│  COMPLETE                            │
╰──────────────────────────────────────╯

Steps:
  ✓ 1. gather
  ✓ 2. rank
  ✓ 3. plan

Final output:

┌ actionPlan ──────────────────────────┐
│ ## Action Plan                       │
│                                      │
│ 1. **Fix login bug** — Reproduce     │
│    with test account, patch session  │
│    handler, add regression test.     │
│ 2. **Add CSV export** — Add export   │
│    button to list views, stream rows │
│    to avoid memory issues.           │
│ 3. **Redesign dashboard** — Start    │
│    with wireframes, get stakeholder  │
│    sign-off before dev.              │
└──────────────────────────────────────┘

(Progress file cleaned up)
```

**Reset:**
```
$ thinker reset prioritise-tasks.json
```

## Repo Map

- `README.md` — agent-facing documentation (installation, commands, config format)
- `.humans/README.md` — human-facing documentation (same content, narrative style)
- `examples/` — sample config files for trying out the CLI
- `src/types.ts` — type definitions: `Config`, `Step`, `Progress`, `SharedSpace`
- `src/config.ts` — load + validate config JSON files
- `src/progress.ts` — progress file CRUD; path derived via SHA256 hash of config path
- `src/interpolate.ts` — pure `{{key}}` placeholder replacement
- `src/color.ts` — ANSI color helpers (green/red/blue/dim/bold); respects `NO_COLOR` env var
- `src/format.ts` — all CLI output rendering (step list, boxes, manual, errors, completion)
- `src/run.ts` — core orchestration: parse args, dispatch start/continue/reset, wire modules
- `src/cli.ts` — thin entry point: `process.argv` → `run()` → stdout + exit code
- `src/*.test.ts` — colocated tests for each module
- `vitest.config.ts` — test config (verbose reporter)
- `tsconfig.json` — TypeScript config (ES2022, Node16, strict)
- `package.json` — project manifest; `pnpm test` runs tests, `pnpm build` compiles to `dist/`

## Working in This Repo

- **Package manager:** pnpm
- **Language:** TypeScript
- **Build:** `pnpm build` compiles to `dist/`
- **Test framework:** Vitest — run with `pnpm test`
- **Test style:** tree-shaped specs using nested `describe`/`it` blocks
- **No external runtime deps** — Node built-ins only (`fs`, `path`, `crypto`)
