# thinker-cli

An orchestrator that guides you through a multi-step thought process. You receive directions, do the work, and call back with structured output. The CLI tracks state and tells you exactly what to do next.

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