import { describe, it, expect } from "vitest";
import { interpolate } from "./interpolate.js";

describe("interpolate", () => {
  it("returns text unchanged when no placeholders exist", () => {
    expect(interpolate("no placeholders here", {})).toBe(
      "no placeholders here"
    );
  });

  it("replaces a single {{key}} with its string value", () => {
    expect(interpolate("Hello {{name}}!", { name: "world" })).toBe(
      "Hello world!"
    );
  });

  it("replaces a {{key}} whose value is an array with JSON", () => {
    expect(interpolate("Tasks: {{tasks}}", { tasks: ["a", "b"] })).toBe(
      'Tasks: ["a","b"]'
    );
  });

  it("replaces a {{key}} whose value is an object with JSON", () => {
    expect(interpolate("Data: {{obj}}", { obj: { x: 1 } })).toBe(
      'Data: {"x":1}'
    );
  });

  it("replaces multiple different placeholders", () => {
    expect(
      interpolate("{{a}} and {{b}}", { a: "first", b: "second" })
    ).toBe("first and second");
  });

  it("replaces the same placeholder appearing twice", () => {
    expect(interpolate("{{x}} then {{x}}", { x: "val" })).toBe(
      "val then val"
    );
  });

  it("leaves {{key}} intact when key is not in shared space", () => {
    expect(interpolate("{{missing}} stays", {})).toBe("{{missing}} stays");
  });
});
