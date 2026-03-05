import type { SharedSpace } from "./types.js";

export function interpolate(template: string, values: SharedSpace): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    const val = values[key];
    return typeof val === "string" ? val : JSON.stringify(val);
  });
}
