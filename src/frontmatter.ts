import { CourierError } from "./errors.js";

export type FrontmatterValue =
  | string
  | string[]
  | Array<Record<string, string>>;

export type Frontmatter = Record<string, FrontmatterValue>;

export function serializeFrontmatter(data: Frontmatter): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      if (value.length === 0) {
        lines.push("  []");
      } else {
        for (const item of value) {
          if (typeof item === "string") {
            lines.push(`  - ${quote(item)}`);
          } else {
            const entries = Object.entries(item);
            const [firstKey, firstValue] = entries[0] ?? ["value", ""];
            lines.push(`  - ${firstKey}: ${quote(firstValue)}`);
            for (const [childKey, childValue] of entries.slice(1)) {
              lines.push(`    ${childKey}: ${quote(childValue)}`);
            }
          }
        }
      }
    } else {
      lines.push(`${key}: ${quote(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function parseFrontmatter(markdown: string): { data: Frontmatter; body: string } {
  if (!markdown.startsWith("---\n")) {
    throw new CourierError("Invalid handoff Markdown: missing frontmatter.");
  }
  const end = markdown.indexOf("\n---", 4);
  if (end === -1) {
    throw new CourierError("Invalid handoff Markdown: unterminated frontmatter.");
  }
  const raw = markdown.slice(4, end).split("\n");
  const body = markdown.slice(end + 5).replace(/^\n/, "");
  const data: Frontmatter = {};

  for (let index = 0; index < raw.length; index += 1) {
    const line = raw[index];
    if (!line.trim()) continue;
    if (line.startsWith(" ")) continue;
    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rest] = match;
    const value = rest.trim();
    if (value) {
      data[key] = unquote(value);
      continue;
    }

    const items: Array<string | Record<string, string>> = [];
    while (index + 1 < raw.length && raw[index + 1].startsWith("  ")) {
      index += 1;
      const itemLine = raw[index];
      if (itemLine.trim() === "[]") continue;
      const scalar = /^  - (.*)$/.exec(itemLine);
      if (!scalar) continue;
      const itemValue = scalar[1];
      const objectStart = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(itemValue);
      if (!objectStart) {
        items.push(unquote(itemValue));
        continue;
      }
      const object: Record<string, string> = { [objectStart[1]]: unquote(objectStart[2] ?? "") };
      while (index + 1 < raw.length && raw[index + 1].startsWith("    ")) {
        index += 1;
        const child = /^    ([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw[index]);
        if (child) object[child[1]] = unquote(child[2] ?? "");
      }
      items.push(object);
    }
    data[key] = items as FrontmatterValue;
  }

  return { data, body };
}

function quote(value: string): string {
  if (/^[A-Za-z0-9_./:@ -]+$/.test(value) && !/:\s/.test(value)) return value;
  return JSON.stringify(value);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}
