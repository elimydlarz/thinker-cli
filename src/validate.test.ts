import { describe, it, expect } from "vitest";
import { validateOutput } from "./validate.js";

describe("validateOutput", () => {
  describe("primitive types", () => {
    describe("when value matches the declared type", () => {
      it("then returns no errors", () => {
        expect(validateOutput({ name: "alice" }, { name: "string" })).toEqual(
          []
        );
        expect(validateOutput({ count: 42 }, { count: "number" })).toEqual([]);
        expect(validateOutput({ ok: true }, { ok: "boolean" })).toEqual([]);
      });
    });

    describe("when value does not match the declared type", () => {
      it("then returns an error describing the mismatch", () => {
        const errors = validateOutput({ name: 42 }, { name: "string" });

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("name");
        expect(errors[0]).toContain("expected string");
        expect(errors[0]).toContain("number");
      });
    });
  });

  describe("Array<T>", () => {
    describe("when value is an array with elements matching element type", () => {
      it("then returns no errors", () => {
        expect(
          validateOutput({ items: ["a", "b"] }, { items: "Array<string>" })
        ).toEqual([]);
      });
    });

    describe("when value is not an array", () => {
      it("then returns an error", () => {
        const errors = validateOutput(
          { items: "not an array" },
          { items: "Array<string>" }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("expected array");
      });
    });

    describe("when an element does not match the element type", () => {
      it("then returns an error identifying the element", () => {
        const errors = validateOutput(
          { items: ["a", 42] },
          { items: "Array<string>" }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("items[1]");
        expect(errors[0]).toContain("expected string");
      });
    });
  });

  describe("object types — { key: type; ... }", () => {
    describe("when value matches the declared shape", () => {
      it("then returns no errors", () => {
        expect(
          validateOutput(
            { task: { id: "1", title: "Do it" } },
            { task: '{ id: string; title: string }' }
          )
        ).toEqual([]);
      });
    });

    describe("when a field is missing", () => {
      it("then returns an error for the missing field", () => {
        const errors = validateOutput(
          { task: { id: "1" } },
          { task: '{ id: string; title: string }' }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("title");
        expect(errors[0]).toContain("missing");
      });
    });

    describe("when a field has the wrong type", () => {
      it("then returns an error for that field", () => {
        const errors = validateOutput(
          { task: { id: 1, title: "Do it" } },
          { task: '{ id: string; title: string }' }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("task.id");
        expect(errors[0]).toContain("expected string");
      });
    });

    describe("when value is not an object", () => {
      it("then returns an error", () => {
        const errors = validateOutput(
          { task: "not an object" },
          { task: '{ id: string; title: string }' }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("expected object");
      });
    });
  });

  describe("double-quoted object keys — { \"key\": type }", () => {
    it("then validates the same as unquoted keys", () => {
      expect(
        validateOutput(
          { task: { id: "1", title: "Do it" } },
          { task: '{ "id": string; "title": string }' }
        )
      ).toEqual([]);
    });
  });

  describe("string literal unions — \"A\" | \"B\"", () => {
    describe("when value matches one of the literals", () => {
      it("then returns no errors", () => {
        expect(
          validateOutput(
            { size: "S" },
            { size: '"S" | "M" | "L"' }
          )
        ).toEqual([]);
      });
    });

    describe("when value does not match any literal", () => {
      it("then returns an error listing the expected values", () => {
        const errors = validateOutput(
          { size: "XL" },
          { size: '"S" | "M" | "L"' }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("size");
      });
    });
  });

  describe("Array of objects — Array<{ key: type; ... }>", () => {
    const typeDecl = 'Array<{ id: string; title: string; effort: "S" | "M" | "L" }>';

    describe("when all elements match the shape", () => {
      it("then returns no errors", () => {
        expect(
          validateOutput(
            {
              tasks: [
                { id: "1", title: "Fix bug", effort: "S" },
                { id: "2", title: "Redesign", effort: "L" },
              ],
            },
            { tasks: typeDecl }
          )
        ).toEqual([]);
      });
    });

    describe("when an element has a field with wrong type", () => {
      it("then returns an error identifying the element and field", () => {
        const errors = validateOutput(
          {
            tasks: [
              { id: "1", title: "Fix bug", effort: "S" },
              { id: 2, title: "Redesign", effort: "L" },
            ],
          },
          { tasks: typeDecl }
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("tasks[1].id");
        expect(errors[0]).toContain("expected string");
      });
    });
  });

  describe("unparseable type expressions", () => {
    it("then accepts any value (graceful fallback)", () => {
      expect(
        validateOutput(
          { result: { anything: "goes" } },
          { result: "SomeCustomType<Foo, Bar>" }
        )
      ).toEqual([]);
    });
  });

  describe("multiple output keys", () => {
    it("then validates each key independently", () => {
      const errors = validateOutput(
        { name: 42, count: "not a number" },
        { name: "string", count: "number" }
      );

      expect(errors).toHaveLength(2);
    });
  });
});
