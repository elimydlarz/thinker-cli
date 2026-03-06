# Thinker CLI

Thinker CLI is an orchestrator that guides an AI agent through a multi-step thought process. It owns the plan; the agent owns the reasoning and the work.

The idea is simple: you define a sequence of steps in a JSON config file, and the CLI walks an agent through them one at a time. On each invocation, it tells the agent what to think about and exactly how to call back with its answer. The agent reasons, acts, calls back, and the CLI advances — step by step until the process completes.

State is persisted to disk between invocations, so the agent can be stateless. The CLI remembers where you are.

## Installation

```
npm install -g thinker-cli
```

Or with pnpm:

```
pnpm add -g thinker-cli
```

## Quick start

### 1. Write a config

Create a JSON file describing your thought process. Each step has a name, directions (what the agent should do), and an output declaration (what it must return):

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
    }
  ]
}
```

Notice `{{tasks}}` in step 2's directions — that gets replaced with the actual output from step 1.

A sample config is included at `examples/prioritise-tasks.json`.

### 2. Start the process

```
$ thinker my-config.json
```

The CLI prints the first step's directions, the output shape you need to provide, and the exact command to call back. It also prints a usage manual on the first run.

### 3. The agent does its work and calls back

```
$ thinker my-config.json '{"tasks": [{"id": "1", "title": "Fix login bug", "effort": "S"}]}'
```

The CLI validates the JSON (right keys? valid JSON?), merges the output into its shared space, and shows the next step with interpolated values from prior steps.

### 4. Repeat until done

When the final step's output is provided, the CLI shows the completed result and cleans up its progress file.

### 5. Reset if needed

```
$ thinker reset my-config.json
```

Deletes the progress file so you can start over.

## How it works under the hood

**Config** — a read-only JSON file defining the step sequence.

**Shared space** — a flat namespace of variables accumulated across steps. Each step's output keys merge into it. Keys are immutable and unique across all steps (enforced at config load time).

**Progress file** — a hidden JSON file (`.thinker-progress-<hash>.json`) created alongside your config file. It stores the current step index and the shared space. This is how the CLI remembers where you are between invocations.

**Interpolation** — `{{key}}` placeholders in directions are replaced with values from the shared space, rendered inside labeled boxes so the agent can clearly see what data is available.

**Step isolation** — the agent sees all step labels (so it knows the overall plan) but only the current step's directions and output shape. It never sees future steps' directions. This prevents agents from trying to skip ahead.

## Config format

```json
{
  "steps": [
    {
      "label": "string — human-readable step name",
      "directions": "string — what the agent should do (supports {{key}} interpolation)",
      "output": {
        "keyName": "TypeScript-style type description"
      }
    }
  ]
}
```

Rules:
- At least one step is required
- Each step must have `label`, `directions`, and `output`
- `output` must have at least one key
- No two steps may declare the same output key

The type descriptions in `output` are for the agent's understanding — the CLI only validates key presence, not value types.

## Error handling

The CLI is designed for AI agents, so it fails fast with helpful errors:
- What went wrong
- What was expected
- The exact command to retry
- The full usage manual (reprinted on every error)

This means agents can self-correct without needing external help.

## Development

```
pnpm install
pnpm test        # run tests
pnpm build       # compile TypeScript to dist/
```
