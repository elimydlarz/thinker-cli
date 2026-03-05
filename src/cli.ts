#!/usr/bin/env node
import { run } from "./run.js";

const { output, exitCode } = run(process.argv.slice(2));
console.log(output);
process.exit(exitCode);
