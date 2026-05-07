import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CourierError } from "./errors.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { replaceVisibleStatus } from "./markdown.js";

export type HandoffStatus = "new" | "acknowledged" | "done";

export type HandoffAttachment = {
  originalPath: string;
  copiedTo: string;
  embedded: boolean;
  reason?: string;
  content?: string;
};

export type HandoffMetadata = {
  id: string;
  title: string;
  status: HandoffStatus;
  createdAt: string;
  updatedAt: string;
  sourceWorkspace: string;
  targetName: string;
  targetWorkspace: string;
  attachments: HandoffAttachment[];
  history: Array<{ at: string; action: string; note: string }>;
};

export type HandoffFile = {
  id: string;
  path: string;
  metadata: HandoffMetadata;
  markdown: string;
};

export function createHandoffId(now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  return `chf_${stamp}_${randomBytes(3).toString("hex")}`;
}

export function metadataFromFrontmatter(data: Record<string, unknown>): HandoffMetadata {
  const attachments = Array.isArray(data.attachments)
    ? data.attachments.map((item) => {
        const object = item as Record<string, string>;
        return {
          originalPath: object.originalPath ?? "",
          copiedTo: object.copiedTo ?? "",
          embedded: object.embedded === "true",
          reason: object.reason || undefined
        };
      })
    : [];
  const history = Array.isArray(data.history)
    ? data.history.map((item) => {
        const object = item as Record<string, string>;
        return {
          at: object.at ?? "",
          action: object.action ?? "",
          note: object.note ?? ""
        };
      })
    : [];

  const status = data.status;
  if (status !== "new" && status !== "acknowledged" && status !== "done") {
    throw new CourierError("Invalid handoff Markdown: unknown status.");
  }

  return {
    id: requireString(data.id, "id"),
    title: requireString(data.title, "title"),
    status,
    createdAt: requireString(data.createdAt, "createdAt"),
    updatedAt: requireString(data.updatedAt, "updatedAt"),
    sourceWorkspace: requireString(data.sourceWorkspace, "sourceWorkspace"),
    targetName: requireString(data.targetName, "targetName"),
    targetWorkspace: requireString(data.targetWorkspace, "targetWorkspace"),
    attachments,
    history
  };
}

export async function readHandoffFile(filePath: string): Promise<HandoffFile> {
  const markdown = await fs.readFile(filePath, "utf8");
  const { data } = parseFrontmatter(markdown);
  const metadata = metadataFromFrontmatter(data);
  return { id: metadata.id, path: filePath, metadata, markdown };
}

export async function listInboxHandoffs(inboxDir: string): Promise<HandoffFile[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(inboxDir);
  } catch {
    return [];
  }
  const files = entries.filter((entry) => entry.endsWith(".md")).sort();
  const handoffs: HandoffFile[] = [];
  for (const file of files) {
    const filePath = path.join(inboxDir, file);
    try {
      handoffs.push(await readHandoffFile(filePath));
    } catch {
      // Ignore malformed files in list views; read/status still reports direct parse failures.
    }
  }
  return handoffs.sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt));
}

export async function findInboxHandoff(inboxDir: string, idPrefix: string): Promise<HandoffFile> {
  const handoffs = await listInboxHandoffs(inboxDir);
  const matches = handoffs.filter((handoff) => handoff.id.startsWith(idPrefix));
  if (matches.length === 0) {
    throw new CourierError(`Handoff not found:\n${idPrefix}`);
  }
  if (matches.length > 1) {
    throw new CourierError(
      [`Handoff id prefix is ambiguous:`, idPrefix, "", "Matches:", ...matches.map((item) => `- ${item.id}`)].join("\n")
    );
  }
  return matches[0];
}

export async function updateHandoffStatus(filePath: string, status: HandoffStatus, note?: string): Promise<HandoffFile> {
  const markdown = await fs.readFile(filePath, "utf8");
  const { data, body } = parseFrontmatter(markdown);
  const metadata = metadataFromFrontmatter(data);
  const now = new Date().toISOString();
  metadata.status = status;
  metadata.updatedAt = now;
  metadata.history.push({
    at: now,
    action: status === "acknowledged" ? "acknowledged" : "done",
    note: note ?? ""
  });
  const nextFrontmatter = serializeFrontmatter({
    id: metadata.id,
    title: metadata.title,
    status: metadata.status,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    sourceWorkspace: metadata.sourceWorkspace,
    targetName: metadata.targetName,
    targetWorkspace: metadata.targetWorkspace,
    attachments: metadata.attachments.map((item) => ({
      originalPath: item.originalPath,
      copiedTo: item.copiedTo,
      embedded: String(item.embedded),
      reason: item.reason ?? ""
    })),
    history: metadata.history
  });
  const nextMarkdown = `${nextFrontmatter}${replaceVisibleStatus(body, status)}`;
  await fs.writeFile(filePath, nextMarkdown, "utf8");
  return readHandoffFile(filePath);
}

function requireString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value) {
    throw new CourierError(`Invalid handoff Markdown: ${key} is required.`);
  }
  return value;
}
