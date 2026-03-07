# Thinker CLI

**Human-programmable multi-turn reasoning for AI agents.**

Thinker lets you define a multi-step thought process in a JSON config file, then hand it to any AI agent that can run CLI tools. The agent follows directions, calls back with structured output, and the CLI advances — step by step until the process completes. No framework integration, no SDK, no code. Just a config and a shell command.

## The idea

AI agents are powerful reasoners, but they drift. Give an agent a complex task and it'll skip steps, conflate concerns, or lose track of earlier conclusions. Thinker solves this by letting _you_ decompose the thought process into discrete steps, each with clear directions and a typed output contract. The agent executes them one at a time, and the CLI enforces the sequence.

The key insight: **the human programs the reasoning process; the agent does the reasoning.** You control _what_ to think about and in _what order_. The agent controls _how_ to think about it.

This separation works because:

- **Step isolation** — the agent sees all step labels (so it knows the overall arc) but only the current step's directions and output shape. It never sees future steps' directions. This prevents agents from racing ahead or collapsing multiple steps into one.
- **Typed output** — each step declares the exact JSON shape the agent must return. The CLI validates it. This forces the agent to produce structured, reusable results rather than free-form prose.
- **Interpolation** — later steps can reference earlier outputs via `{{key}}` placeholders. The CLI renders these as labeled boxes in the directions, so the agent builds on its own prior reasoning naturally.
- **Stateless agents** — the CLI persists all state to disk. The agent can be completely stateless between invocations. This means it works with any agent — Claude Code, OpenClaw, custom scripts, anything that can shell out.

## Adding thinker to your agent

Thinker works with any agent that can execute CLI commands. Some examples:

**Claude Code** — add `thinker` as a tool in your CLAUDE.md or give the agent access to shell commands. It will read the CLI output, follow directions, and call back.

**OpenClaw** — register `thinker` as a CLI tool. The agent receives the step directions as tool output and calls back with the required JSON.

**Any MCP-compatible agent** — if your agent can run shell commands via MCP or a similar protocol, it can use thinker.

**Custom agents** — parse the CLI's stdout in your agent loop. The output is human-readable but structured enough to extract programmatically if needed.

The pattern is always the same: agent calls `thinker config.json`, reads the directions, does the work, calls `thinker config.json '{"key": value}'`, and repeats.

## Installation

Run directly with pnpx (no install needed):

```
pnpx @susu-eng/thinker-cli <config-path>
```

Or install globally:

```
pnpm add -g @susu-eng/thinker-cli
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

A sample config is included at `examples/travel-preferences.json`.

### 2. Start the process

```
$ thinker my-config.json
```

The CLI prints the first step's directions, the output shape you need to provide, and the exact command to call back. It also prints a usage manual on the first run.

### 3. The agent does its work and calls back

```
$ thinker my-config.json '{"tasks": [{"id": "1", "title": "Fix login bug", "effort": "S"}]}'
```

The CLI validates the JSON (right keys? right types?), merges the output into its shared space, and shows the next step with interpolated values from prior steps.

### 4. Repeat until done

When the final step's output is provided, the CLI shows the completed result and cleans up its progress file.

### 5. Reset if needed

```
$ thinker reset my-config.json
```

Deletes the progress file so you can start over.

## How it works under the hood

**Config** — a read-only JSON file defining the step sequence. This is the thought process blueprint that the human authors.

**Shared space** — a flat namespace of variables accumulated across steps. Each step's output keys merge into it. Keys are immutable and unique across all steps (enforced at config load time).

**Progress file** — a hidden JSON file (`.thinker-progress-<hash>.json`) created alongside your config file. It stores the current step index and the shared space. This is how the CLI remembers where the agent is between invocations.

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

Run `thinker config-help` for a full authoring guide with supported types and examples.

## Development

```
pnpm install
pnpm test        # run tests
pnpm build       # compile TypeScript to dist/
```
