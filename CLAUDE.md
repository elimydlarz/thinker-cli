# Thinker CLI

Thinker CLI is a stateless orchestrator that guides an external AI agent through a multi-step thought process. Instead of running inference itself, it:

1. Takes a config defining a sequence of steps (each with directions)
2. On each invocation, prompts the agent with what to do next and how to invoke the CLI again with its result
3. The agent reasons, acts, then calls the CLI again with its output — advancing the state machine
4. This loops until all steps are complete, at which point the final result is returned

The agent replaces LLM inference, and the CLI replaces orchestration logic. The agent just follows the CLI's instructions until it gets a terminal result.

This is inspired by an internal library (see `think` function in the original codebase) that recursively iterates through preconfigured thought process steps using Google GenAI — but "unrolled" across multiple CLI invocations so any agent can drive the process.

## Repo Map

- `src/` — source code and tests (colocated `*.test.ts` files)
- `vitest.config.ts` — test config (verbose/tree-style reporter)
- `package.json` — project manifest; `pnpm test` runs `vitest run`

## Working in This Repo

- **Package manager:** pnpm
- **Language:** TypeScript
- **Test framework:** Vitest — run with `pnpm test`
- **Test style:** tree-shaped specs using nested `describe`/`it` blocks
