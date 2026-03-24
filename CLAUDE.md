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
- **continue** — `thinker <config-path> '<json>'` advances the process. The JSON must be an object whose keys match the current step's declared `output`, and whose values match the declared types. The CLI merges those keys into the shared space, advances to the next step, and emits its directions.
- **complete** — when all steps are done, emit the final result and clean up the progress file.
- **reset** — `thinker reset <config-path>` deletes the progress file, allowing a fresh start.
- **config-help** — `thinker config-help` prints a standalone guide on how to write config files: structure (steps array with label/directions/output), supported types, interpolation syntax, uniqueness rules, and an example config.
- **config-format** — JSON file with an ordered list of steps. Each step has `label` (string), `directions` (string), and `output` (map of key names to TypeScript-style type descriptions, e.g. `{ "tasks": "Array<{ id: string; title: string }>" }`).
- **config-validation** — at load time, reject configs where two steps declare the same output key. Variables are immutable — no collisions allowed.
- **progress-tracking** — progress is saved to disk, keyed to the config file path. Stores current step index and the shared space (all accumulated output key-value pairs).
- **output-type-validation** — when the agent provides output JSON, validate that values match the declared TypeScript-style types. Supports primitives (`string`, `number`, `boolean`), `Array<T>`, object types (`{ key: type; ... }`), string literal unions (`"A" | "B"`), and type unions (`string | number`). Optional fields are NOT supported — all declared fields are required. Unparseable type expressions are accepted without validation (graceful fallback). Errors identify the exact path (e.g. `tasks[1].id`) and the type mismatch.
- **directions-interpolation** — directions can contain `{{key}}` placeholders. The CLI replaces them with the corresponding value from the shared space before displaying.

### Cross-functional

- **output-format** — CLI output is nicely formatted text. Shows the step list (completed and current only, with a count of remaining steps), the current step's directions with interpolated values visually demarcated, and the exact callback command with the required JSON shape. Type descriptions in the callback command use double quotes internally (single quotes are replaced) so they don't break the outer single-quoted shell string. Object keys inside type descriptions are also double-quoted (e.g. `Array<{ "id": string }>` not `Array<{ id: string }>`) for consistency with JSON notation. The config path is displayed without the `.json` extension in all output (callback commands, manual, errors).
- **step-isolation** — show completed step labels (marked) and the current step label (highlighted). Future step labels are hidden — only a count of remaining steps is shown (e.g. `+ 2 more steps`). Show the current step's directions + output shape + interpolated prior values. Never reveal other steps' directions, future step labels, or future output shapes.
- **extensionless-config-path** — the CLI accepts config paths with or without the `.json` extension. If the given path does not exist, it tries appending `.json`. The display path in all output strips `.json` to discourage agents from reading the config file directly.
- **agent-first-errors** — validate all input strictly (JSON parsing, expected output keys, config structure). On failure: explain what went wrong, show what was expected, tell the agent exactly how to retry. Any error that occurs while the agent is on a step (already in progress, bad JSON, wrong keys, type mismatch) repeats the current step's full instructions (step list, directions, callback command) so the agent can retry without a separate invocation. All errors also include the CLI manual.
- **agent-first-manual** — a full orientation guide shown when: error OR no args (bare invocation). Not shown on: successful start, successful continue, or completion. Bare invocation (no args) is not an error — it just shows the manual with a `<config>` placeholder and exits 0. Explains what thinker is (a guided thought process CLI), the workflow (directions → work → callback → next step), the output contract (exact keys, no extra, no missing), and all commands (start, continue, reset, config-help).

## Usage Example

See `examples/travel-preferences.json` for a ready-to-run sample config. Try it:

```
$ thinker examples/travel-preferences.json
```
```
Steps:
  ▶ 1. destination
    2. interests
    3. constraints
    4. itinerary

╭──────────────────────────────────────╮
│  STEP 1/4 — destination              │
╰──────────────────────────────────────╯

Where do you want to go, and what's the vibe
— budget-friendly, mid-range, or luxury?

────────────────────────────────────────
To continue, run:

  thinker travel-preferences.json '{
    "destination": string,
    "budget": "budget-friendly" | "mid-range" | "luxury"
  }'
```

The agent picks a destination and calls back:
```
$ thinker travel-preferences.json '{ "destination": "Japan", "budget": "mid-range" }'
```

**Invocation 2** — CLI merges `destination` and `budget` into shared space, shows next step with them interpolated:
```
Steps:
  ✓ 1. destination
  ▶ 2. interests
    3. constraints
    4. itinerary

╭──────────────────────────────────────╮
│  STEP 2/4 — interests                │
╰──────────────────────────────────────╯

You're planning a
┌ budget ──────────────────────────────┐
│ mid-range                            │
└──────────────────────────────────────┘
trip to
┌ destination ─────────────────────────┐
│ Japan                                │
└──────────────────────────────────────┘
. What kind of experiences are you
after? Pick your top interests and rate
how important each one is.

────────────────────────────────────────
To continue, run:

  thinker travel-preferences.json '{
    "interests": Array<{ "name": string; "priority": "must-do" | "nice-to-have" }>
  }'
```

**Invocation 3** — agent provides interests, CLI shows constraints step with all prior values interpolated:
```
$ thinker travel-preferences.json '{ "interests": [{"name":"street food","priority":"must-do"},{"name":"temples","priority":"must-do"},{"name":"hiking","priority":"nice-to-have"}] }'
```
```
Steps:
  ✓ 1. destination
  ✓ 2. interests
  ▶ 3. constraints
    4. itinerary

╭──────────────────────────────────────╮
│  STEP 3/4 — constraints              │
╰──────────────────────────────────────╯

Given your
┌ budget ──────────────────────────────┐
│ mid-range                            │
└──────────────────────────────────────┘
trip to
┌ destination ─────────────────────────┐
│ Japan                                │
└──────────────────────────────────────┘
with these interests:

┌ interests ───────────────────────────┐
│ [{"name":"street food",              │
│   "priority":"must-do"},             │
│  {"name":"temples",                  │
│   "priority":"must-do"},             │
│  {"name":"hiking",                   │
│   "priority":"nice-to-have"}]        │
└──────────────────────────────────────┘

Are there any constraints the plan
should respect? (e.g. dietary needs,
accessibility, pace, travel companions,
trip length)

────────────────────────────────────────
To continue, run:

  thinker travel-preferences.json '{
    "constraints": string
  }'
```

**Invocation 4** — agent provides constraints, CLI shows final step with everything interpolated:
```
$ thinker travel-preferences.json '{ "constraints": "Vegetarian. 7 days. Moderate pace — no more than 2 major activities per day." }'
```
```
Steps:
  ✓ 1. destination
  ✓ 2. interests
  ✓ 3. constraints
  ▶ 4. itinerary

╭──────────────────────────────────────╮
│  STEP 4/4 — itinerary                │
╰──────────────────────────────────────╯

Build a day-by-day itinerary for a
┌ budget ──────────────────────────────┐
│ mid-range                            │
└──────────────────────────────────────┘
trip to
┌ destination ─────────────────────────┐
│ Japan                                │
└──────────────────────────────────────┘
.

Interests:

┌ interests ───────────────────────────┐
│ [{"name":"street food",              │
│   "priority":"must-do"},             │
│  {"name":"temples",                  │
│   "priority":"must-do"},             │
│  {"name":"hiking",                   │
│   "priority":"nice-to-have"}]        │
└──────────────────────────────────────┘

Constraints:

┌ constraints ─────────────────────────┐
│ Vegetarian. 7 days. Moderate pace —  │
│ no more than 2 major activities per  │
│ day.                                 │
└──────────────────────────────────────┘

Structure it as a practical, actionable
plan.

────────────────────────────────────────
To continue, run:

  thinker travel-preferences.json '{
    "itinerary": string
  }'
```

**Invocation 5** — agent provides the itinerary, process completes:
```
$ thinker travel-preferences.json '{ "itinerary": "## 7-Day Japan Itinerary\n\nDay 1 — Tokyo: Arrive, explore Senso-ji temple, evening street food tour in Asakusa.\nDay 2 — Tokyo: Meiji Shrine in the morning, vegetarian ramen in Shinjuku.\nDay 3 — Hakone: Day trip, hiking the Old Tokaido Road, lake cruise.\nDay 4 — Kyoto: Fushimi Inari in the morning, Nishiki Market for street food.\nDay 5 — Kyoto: Kinkaku-ji, afternoon at Arashiyama bamboo grove.\nDay 6 — Nara: Todai-ji temple, deer park, vegetarian shojin ryori lunch.\nDay 7 — Osaka: Dotonbori street food, Osaka Castle, depart." }'
```
```
╭──────────────────────────────────────╮
│  COMPLETE                            │
╰──────────────────────────────────────╯

Steps:
  ✓ 1. destination
  ✓ 2. interests
  ✓ 3. constraints
  ✓ 4. itinerary

Final output:

┌ itinerary ───────────────────────────┐
│ ## 7-Day Japan Itinerary             │
│                                      │
│ Day 1 — Tokyo: Arrive, explore       │
│   Senso-ji temple, evening street    │
│   food tour in Asakusa.             │
│ Day 2 — Tokyo: Meiji Shrine in the   │
│   morning, vegetarian ramen in       │
│   Shinjuku.                          │
│ Day 3 — Hakone: Day trip, hiking the │
│   Old Tokaido Road, lake cruise.     │
│ Day 4 — Kyoto: Fushimi Inari in the  │
│   morning, Nishiki Market for        │
│   street food.                       │
│ Day 5 — Kyoto: Kinkaku-ji, afternoon │
│   at Arashiyama bamboo grove.        │
│ Day 6 — Nara: Todai-ji temple, deer  │
│   park, vegetarian shojin ryori      │
│   lunch.                             │
│ Day 7 — Osaka: Dotonbori street      │
│   food, Osaka Castle, depart.        │
└──────────────────────────────────────┘

(Progress file cleaned up)
```

**Reset:**
```
$ thinker reset travel-preferences.json
```

## Repo Map

- `README.md` — agent-facing documentation (installation, commands, config format)
- `.humans/README.md` — human-facing documentation (same content, narrative style)
- `examples/` — sample config files for trying out the CLI
- `src/types.ts` — type definitions: `Config`, `Step`, `Progress`, `SharedSpace`
- `src/config.ts` — load + validate config JSON files
- `src/progress.ts` — progress file CRUD; path derived via SHA256 hash of config path
- `src/validate.ts` — type expression parser and runtime type validator for step output
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
