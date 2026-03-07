# thinker-cli

**Human-programmable multi-turn reasoning for AI agents.**

You write a JSON config. Any agent that can run a CLI tool gets structured, multi-step reasoning — no framework integration, no SDK, no code. Just a config file and a shell command.

Add it to [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenClaw](https://github.com/anthropics/openclaw), or any agent that can execute CLI tools. The agent calls `thinker`, follows the directions, calls back with structured output, and the CLI advances to the next step. The human controls the thought process; the agent does the thinking.

## Why this works

Agents are good at reasoning. They're bad at staying on track across many turns. Thinker gives you a way to decompose a complex thought process into discrete steps — each with clear directions, typed output, and access to everything produced so far — and have the agent execute them one at a time.

The trick: the CLI owns the plan, the agent owns the reasoning. The agent never sees future steps' directions (it would skip ahead). It only sees what it needs right now: what to do, what shape to return, and prior results interpolated into the current directions.

You define the thought process once in JSON. Then any agent can run it, repeatedly, reliably.

## Install

Run directly with pnpx (no install needed):

```
pnpx @susu-eng/thinker-cli <config-path>
```

Or install globally:

```
pnpm add -g @susu-eng/thinker-cli
```

## Commands

Start a process:

```
pnpx @susu-eng/thinker-cli <config-path>
```

Continue with output for the current step:

```
pnpx @susu-eng/thinker-cli <config-path> '{"key": value}'
```

Reset (discard progress, start over):

```
pnpx @susu-eng/thinker-cli reset <config-path>
```

Show config authoring guide:

```
pnpx @susu-eng/thinker-cli config-help
```

## How it works

1. You run `thinker config.json`. The CLI shows step 1's directions and the JSON shape you must return.
2. You do the work described in the directions.
3. You call back: `thinker config.json '{"key": your_output}'`. The CLI validates your output, saves it, and shows the next step — with prior outputs interpolated into the directions.
4. Repeat until all steps are complete.

Each step declares named output keys with TypeScript-style type descriptions. You must return a JSON object with exactly those keys — no extra, no missing.

## Config format

A JSON file with an ordered list of steps:

```json
{
  "steps": [
    {
      "label": "step-name",
      "directions": "What to do. Use {{prior_key}} to reference earlier output.",
      "output": {
        "result_key": "TypeScript-style type description"
      }
    }
  ]
}
```

- `label` — human-readable step name
- `directions` — prose instructions; `{{key}}` placeholders are replaced with values from prior steps
- `output` — map of key names to type descriptions; this is the contract you must fulfil

No two steps may declare the same output key.

## Example

A sample config is included at `examples/travel-preferences.json`. Run it:

```
thinker examples/travel-preferences.json
```

The CLI will show step 1 directions and the exact command to call back with your output. Follow the instructions step by step until completion.
