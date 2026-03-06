type TypeNode =
  | { kind: "primitive"; name: "string" | "number" | "boolean" }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; fields: Array<{ key: string; type: TypeNode }> }
  | { kind: "union"; members: TypeNode[] }
  | { kind: "literal"; value: string }
  | { kind: "any" };

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let angleDepth = 0;
  let braceDepth = 0;
  let inQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === '"' && (i === 0 || input[i - 1] !== "\\")) {
      inQuote = !inQuote;
      current += ch;
      continue;
    }

    if (inQuote) {
      current += ch;
      continue;
    }

    if (ch === "<") angleDepth++;
    if (ch === ">") angleDepth--;
    if (ch === "{") braceDepth++;
    if (ch === "}") braceDepth--;

    if (angleDepth === 0 && braceDepth === 0 && ch === delimiter) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current);
  return parts;
}

function findTopLevelColon(input: string): number {
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && (i === 0 || input[i - 1] !== "\\")) {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === ":") return i;
  }
  return -1;
}

function parseType(input: string): TypeNode {
  const trimmed = input.trim();

  const alternatives = splitTopLevel(trimmed, "|");
  if (alternatives.length > 1) {
    return { kind: "union", members: alternatives.map((a) => parseType(a)) };
  }

  if (trimmed === "string") return { kind: "primitive", name: "string" };
  if (trimmed === "number") return { kind: "primitive", name: "number" };
  if (trimmed === "boolean") return { kind: "primitive", name: "boolean" };

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return { kind: "literal", value: trimmed.slice(1, -1) };
  }

  if (trimmed.startsWith("Array<") && trimmed.endsWith(">")) {
    const inner = trimmed.slice(6, -1);
    return { kind: "array", element: parseType(inner) };
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return { kind: "object", fields: [] };
    const fieldParts = splitTopLevel(inner, ";");
    const fields: Array<{ key: string; type: TypeNode }> = [];
    for (const part of fieldParts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;
      const colonIdx = findTopLevelColon(trimmedPart);
      if (colonIdx === -1) continue;
      let key = trimmedPart.slice(0, colonIdx).trim();
      const typeStr = trimmedPart.slice(colonIdx + 1).trim();
      if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
      }
      fields.push({ key, type: parseType(typeStr) });
    }
    return { kind: "object", fields };
  }

  return { kind: "any" };
}

function typeToString(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return node.name;
    case "literal":
      return `"${node.value}"`;
    case "array":
      return `Array<${typeToString(node.element)}>`;
    case "object":
      return `{ ${node.fields.map((f) => `${f.key}: ${typeToString(f.type)}`).join("; ")} }`;
    case "union":
      return node.members.map(typeToString).join(" | ");
    case "any":
      return "any";
  }
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateValue(
  value: unknown,
  type: TypeNode,
  path: string
): string[] {
  switch (type.kind) {
    case "any":
      return [];

    case "primitive":
      if (typeof value !== type.name) {
        return [
          `${path}: expected ${type.name}, got ${describeValue(value)}`,
        ];
      }
      return [];

    case "literal":
      if (value !== type.value) {
        return [
          `${path}: expected "${type.value}", got ${JSON.stringify(value)}`,
        ];
      }
      return [];

    case "array":
      if (!Array.isArray(value)) {
        return [`${path}: expected array, got ${describeValue(value)}`];
      }
      return value.flatMap((el, i) =>
        validateValue(el, type.element, `${path}[${i}]`)
      );

    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return [`${path}: expected object, got ${describeValue(value)}`];
      }
      return type.fields.flatMap((field) => {
        const obj = value as Record<string, unknown>;
        if (!(field.key in obj)) {
          return [`${path}.${field.key}: missing required field`];
        }
        return validateValue(obj[field.key], field.type, `${path}.${field.key}`);
      });

    case "union": {
      const memberErrors = type.members.map((m) => validateValue(value, m, path));
      if (memberErrors.every((e) => e.length > 0)) {
        return [
          `${path}: expected ${typeToString(type)}, got ${JSON.stringify(value)}`,
        ];
      }
      return [];
    }
  }
}

export function validateOutput(
  data: Record<string, unknown>,
  outputDecl: Record<string, string>
): string[] {
  return Object.entries(outputDecl).flatMap(([key, typeStr]) =>
    validateValue(data[key], parseType(typeStr), key)
  );
}
