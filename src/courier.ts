import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, loadConfig, pathExists, writeConfig } from "./config.js";
import { CourierError } from "./errors.js";
import {
  createHandoffId,
  findInboxHandoff,
  listInboxHandoffs,
  metadataFromFrontmatter,
  readHandoffFile,
  updateHandoffStatus
} from "./handoff.js";
import type { HandoffAttachment, HandoffMetadata, HandoffStatus } from "./handoff.js";
import { parseFrontmatter } from "./frontmatter.js";
import { renderHandoffMarkdown } from "./markdown.js";
import { displayPath, workspacePaths } from "./paths.js";
import { slugify } from "./slug.js";
import { addTarget, ensureTargetWorkspace, listTargets, resolveTarget } from "./targets.js";

const EMBED_LIMIT_BYTES = 100 * 1024;

export type SendOptions = {
  to: string;
  title?: string;
  message?: string;
  file?: string;
};

export async function initWorkspace(root: string, force = false): Promise<string> {
  const paths = workspacePaths(root);
  const lines: string[] = [];
  for (const dir of [paths.courierDir, paths.inboxDir, paths.sentDir, paths.attachmentsDir]) {
    const existed = await pathExists(dir);
    await fs.mkdir(dir, { recursive: true });
    if (!existed) lines.push(`Created ${displayPath(dir, root)}/`);
  }
  if ((await pathExists(paths.configPath)) && !force) {
    lines.push(".courier/config.json already exists. Use --force to overwrite.");
  } else {
    await writeConfig(root, DEFAULT_CONFIG);
    lines.push(`Created ${displayPath(paths.configPath, root)}`);
  }
  return lines.join("\n");
}

export async function targetAddCommand(root: string, name: string, targetPath: string, force = false): Promise<string> {
  const target = await addTarget(root, name, targetPath, force);
  return [`Added target "${name}":`, `  path: ${target.path}`, `  inbox: .courier/inbox`, `  mode: ${target.mode}`].join("\n");
}

export async function targetsCommand(root: string): Promise<string> {
  const targets = await listTargets(root);
  if (targets.length === 0) {
    return "No targets configured.\nRun `courier target add <name> <path>` to add one.";
  }
  const lines = ["Targets", ""];
  for (const target of targets) {
    lines.push(target.name, `  path:  ${target.path}`, `  inbox: ${target.inbox}`, `  status: ${target.status}`, "");
  }
  return lines.join("\n").trimEnd();
}

export async function sendCommand(root: string, options: SendOptions): Promise<string> {
  await loadConfig(root);
  const message = options.message ?? "";
  if (!message && !options.file) {
    throw new CourierError("At least one of message or --file is required.");
  }

  const target = await resolveTarget(root, options.to);
  await ensureTargetWorkspace(target);
  const sourcePaths = workspacePaths(root);
  await fs.mkdir(sourcePaths.sentDir, { recursive: true });

  const now = new Date().toISOString();
  const id = createHandoffId(new Date(now));
  const attachment = options.file ? await prepareAttachment(root, target.path, id, options.file) : undefined;
  const title = options.title ?? inferTitle(message, attachment);
  const metadata: HandoffMetadata = {
    id,
    title,
    status: "new",
    createdAt: now,
    updatedAt: now,
    sourceWorkspace: root,
    targetName: target.name,
    targetWorkspace: target.path,
    attachments: attachment ? [attachment] : [],
    history: [{ at: now, action: "created", note: "Created by courier send" }]
  };
  const handoffFile = path.join(target.inbox, `${id}-${slugify(title)}.md`);
  const markdown = renderHandoffMarkdown(metadata, message, attachment);
  await fs.writeFile(handoffFile, markdown, "utf8");

  const receipt = {
    id,
    title,
    targetName: target.name,
    targetWorkspace: target.path,
    targetHandoffPath: handoffFile,
    createdAt: now
  };
  await fs.writeFile(path.join(sourcePaths.sentDir, `${id}.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  const warning = target.mode === "manual" ? [] : [`Warning: target mode "${target.mode}" is reserved; using manual behavior.`, ""];
  return [
    ...warning,
    "Sent handoff",
    "",
    `  id:     ${id}`,
    `  to:     ${target.name}`,
    `  status: new`,
    `  file:   ${handoffFile}`,
    "",
    "Run in target workspace:",
    "  courier inbox",
    `  courier read ${id}`
  ].join("\n");
}

export async function inboxCommand(root: string, all = false): Promise<string> {
  const handoffs = await listInboxHandoffs(workspacePaths(root).inboxDir);
  const visible = all ? handoffs : handoffs.filter((handoff) => handoff.metadata.status !== "done");
  if (visible.length === 0) return all ? "No handoffs." : "No active handoffs.";

  const lines = ["Inbox", ""];
  for (const status of ["new", "acknowledged", "done"] as HandoffStatus[]) {
    const group = visible.filter((handoff) => handoff.metadata.status === status);
    if (group.length === 0) continue;
    lines.push(status);
    for (const handoff of group) {
      lines.push(
        `  ${handoff.id}  ${handoff.metadata.title}`,
        `  from: ${handoff.metadata.sourceWorkspace}`,
        `  sent: ${handoff.metadata.createdAt}`,
        ""
      );
    }
  }
  return lines.join("\n").trimEnd();
}

export async function readCommand(root: string, idPrefix: string): Promise<string> {
  const handoff = await findInboxHandoff(workspacePaths(root).inboxDir, idPrefix);
  return handoff.markdown;
}

export async function ackCommand(root: string, idPrefix: string, note?: string): Promise<string> {
  const handoff = await findInboxHandoff(workspacePaths(root).inboxDir, idPrefix);
  const updated = await updateHandoffStatus(handoff.path, "acknowledged", note);
  return `Acknowledged handoff:\n${updated.id}`;
}

export async function doneCommand(root: string, idPrefix: string, note?: string): Promise<string> {
  const handoff = await findInboxHandoff(workspacePaths(root).inboxDir, idPrefix);
  const updated = await updateHandoffStatus(handoff.path, "done", note);
  return `Completed handoff:\n${updated.id}`;
}

export async function sentCommand(root: string): Promise<string> {
  const receipts = await listSentReceipts(root);
  if (receipts.length === 0) return "No sent handoffs.";
  const lines = ["Sent", ""];
  for (const receipt of receipts) {
    const current = await inspectReceiptStatus(receipt);
    lines.push(
      `${receipt.id}  ${receipt.title}`,
      `  to: ${receipt.targetName}`,
      `  status: ${current.status}`,
      `  sent: ${receipt.createdAt}`,
      ""
    );
  }
  return lines.join("\n").trimEnd();
}

export async function statusCommand(root: string, idPrefix: string): Promise<string> {
  const receiver = await findInboxHandoffMaybe(workspacePaths(root).inboxDir, idPrefix);
  if (receiver) {
    const metadata = receiver.metadata;
    return [
      "Handoff status",
      "",
      `id:      ${metadata.id}`,
      `title:   ${metadata.title}`,
      `from:    ${metadata.sourceWorkspace}`,
      `status:  ${metadata.status}`,
      `sent:    ${metadata.createdAt}`,
      `updated: ${metadata.updatedAt}`,
      `file:    ${receiver.path}`
    ].join("\n");
  }

  const receipt = await findSentReceipt(root, idPrefix);
  const current = await inspectReceiptStatus(receipt);
  return [
    "Handoff status",
    "",
    `id:      ${receipt.id}`,
    `title:   ${receipt.title}`,
    `to:      ${receipt.targetName}`,
    `status:  ${current.status}`,
    `sent:    ${receipt.createdAt}`,
    `updated: ${current.updatedAt ?? "unknown"}`,
    `file:    ${receipt.targetHandoffPath}`
  ].join("\n");
}

async function prepareAttachment(root: string, targetWorkspace: string, id: string, file: string): Promise<HandoffAttachment> {
  const sourcePath = path.resolve(root, file);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(sourcePath);
  } catch {
    throw new CourierError(`Could not read file:\n${file}`);
  }
  const fileName = path.basename(sourcePath);
  const targetDir = path.join(targetWorkspace, ".courier", "attachments", id);
  await fs.mkdir(targetDir, { recursive: true });
  const copiedPath = path.join(targetDir, fileName);
  await fs.copyFile(sourcePath, copiedPath);

  const copiedTo = path.posix.join(".courier", "attachments", id, fileName);
  const originalPath = file;
  if (!isText(buffer)) {
    return { originalPath, copiedTo, embedded: false, reason: "file appears to be binary" };
  }
  if (buffer.byteLength > EMBED_LIMIT_BYTES) {
    return { originalPath, copiedTo, embedded: false, reason: "file exceeded the embed size limit" };
  }
  return { originalPath, copiedTo, embedded: true, content: buffer.toString("utf8") };
}

function isText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.length === 0) return true;
  let suspicious = 0;
  for (const byte of sample) {
    const allowed = byte === 9 || byte === 10 || byte === 13 || byte >= 32;
    if (!allowed) suspicious += 1;
  }
  return suspicious / sample.length < 0.1;
}

function inferTitle(message: string, attachment?: HandoffAttachment): string {
  const firstLine = message.split(/\r?\n/).find((line) => line.trim());
  if (firstLine) return firstLine.trim().slice(0, 80);
  if (attachment) return `Attachment: ${path.basename(attachment.originalPath)}`;
  return "Untitled handoff";
}

type SentReceipt = {
  id: string;
  title: string;
  targetName: string;
  targetWorkspace: string;
  targetHandoffPath: string;
  createdAt: string;
};

async function listSentReceipts(root: string): Promise<SentReceipt[]> {
  const sentDir = workspacePaths(root).sentDir;
  let entries: string[];
  try {
    entries = await fs.readdir(sentDir);
  } catch {
    return [];
  }
  const receipts: SentReceipt[] = [];
  for (const entry of entries.filter((item) => item.endsWith(".json")).sort()) {
    try {
      receipts.push(JSON.parse(await fs.readFile(path.join(sentDir, entry), "utf8")) as SentReceipt);
    } catch {
      // Ignore malformed receipts in list output.
    }
  }
  return receipts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function findSentReceipt(root: string, idPrefix: string): Promise<SentReceipt> {
  const receipts = await listSentReceipts(root);
  const matches = receipts.filter((receipt) => receipt.id.startsWith(idPrefix));
  if (matches.length === 0) throw new CourierError(`Handoff not found:\n${idPrefix}`);
  if (matches.length > 1) {
    throw new CourierError(
      [`Handoff id prefix is ambiguous:`, idPrefix, "", "Matches:", ...matches.map((item) => `- ${item.id}`)].join("\n")
    );
  }
  return matches[0];
}

async function findInboxHandoffMaybe(inboxDir: string, idPrefix: string) {
  try {
    return await findInboxHandoff(inboxDir, idPrefix);
  } catch (error) {
    if (error instanceof CourierError && error.message.startsWith("Handoff not found:")) return undefined;
    throw error;
  }
}

async function inspectReceiptStatus(receipt: SentReceipt): Promise<{ status: string; updatedAt?: string }> {
  try {
    await fs.access(receipt.targetWorkspace);
  } catch {
    return { status: "unavailable" };
  }
  try {
    const handoff = await readHandoffFile(receipt.targetHandoffPath);
    return { status: handoff.metadata.status, updatedAt: handoff.metadata.updatedAt };
  } catch {
    try {
      await fs.access(receipt.targetHandoffPath);
    } catch {
      return { status: "missing" };
    }
    const raw = await fs.readFile(receipt.targetHandoffPath, "utf8");
    const { data } = parseFrontmatter(raw);
    const metadata = metadataFromFrontmatter(data);
    return { status: metadata.status, updatedAt: metadata.updatedAt };
  }
}
