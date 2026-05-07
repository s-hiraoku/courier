import type { HandoffAttachment, HandoffMetadata } from "./handoff.js";
import { serializeFrontmatter } from "./frontmatter.js";

export function renderHandoffMarkdown(metadata: HandoffMetadata, message: string, attachment?: HandoffAttachment): string {
  const frontmatter = serializeFrontmatter({
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

  const lines = [
    `# Courier Handoff: ${metadata.title}`,
    "",
    "## Status",
    "",
    metadata.status,
    "",
    "## From",
    "",
    `- Source workspace: \`${metadata.sourceWorkspace}\``,
    `- Sent at: \`${metadata.createdAt}\``,
    "",
    "## To",
    "",
    `- Target: \`${metadata.targetName}\``,
    `- Target path: \`${metadata.targetWorkspace}\``,
    "",
    "## Message",
    "",
    message || "_No message provided._",
    ""
  ];

  if (attachment) {
    lines.push(...renderAttachment(attachment), "");
  }

  lines.push(
    "## Suggested Next Action",
    "",
    "Inspect this handoff and decide whether it should become an issue, task, bugfix, design note, or follow-up discussion.",
    ""
  );

  return `${frontmatter}${lines.join("\n")}`;
}

export function replaceVisibleStatus(body: string, status: string): string {
  const replacement = `## Status\n\n${status}`;
  if (/## Status\n\n[\s\S]*?(?=\n## |\n?$)/.test(body)) {
    return body.replace(/## Status\n\n[\s\S]*?(?=\n## |\n?$)/, replacement);
  }
  return `${replacement}\n\n${body}`;
}

function renderAttachment(attachment: HandoffAttachment): string[] {
  const lines = [
    "## Attached Context",
    "",
    `- File: \`${attachment.originalPath}\``,
    `- Copied to: \`${attachment.copiedTo}\``,
    `- Embedded: ${attachment.embedded ? "yes" : "no"}`
  ];
  if (!attachment.embedded && attachment.reason) {
    lines.push(`- Reason: ${attachment.reason}`);
  }
  if (attachment.embedded && attachment.content !== undefined) {
    lines.push("", "```txt", attachment.content, "```");
  }
  return lines;
}
