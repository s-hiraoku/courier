import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ackCommand,
  doneCommand,
  inboxCommand,
  initWorkspace,
  readCommand,
  sendCommand,
  sentCommand,
  statusCommand,
  targetAddCommand,
  targetsCommand
} from "../src/courier.js";
import { loadConfig, writeConfig } from "../src/config.js";
import { CourierError } from "../src/errors.js";
import { parseFrontmatter } from "../src/frontmatter.js";
import { readHandoffFile } from "../src/handoff.js";
import { expandHome, workspacePaths } from "../src/paths.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "courier-test-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function mkdir(name: string): Promise<string> {
  const dir = path.join(tempRoot, name);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function idFromSend(output: string): string {
  const match = /id:\s+(chf_[^\s]+)/.exec(output);
  expect(match).toBeTruthy();
  return match![1];
}

function fileFromSend(output: string): string {
  const match = /file:\s+(.+\.md)/.exec(output);
  expect(match).toBeTruthy();
  return match![1];
}

describe("config and targets", () => {
  it("initializes courier directories and config without overwriting by default", async () => {
    const root = await mkdir("source");
    const output = await initWorkspace(root);

    await expect(fs.stat(workspacePaths(root).configPath)).resolves.toBeTruthy();
    await expect(fs.stat(workspacePaths(root).inboxDir)).resolves.toBeTruthy();
    await expect(fs.stat(workspacePaths(root).sentDir)).resolves.toBeTruthy();
    await expect(fs.stat(workspacePaths(root).attachmentsDir)).resolves.toBeTruthy();
    expect(output).toContain("Created .courier/config.json");

    const second = await initWorkspace(root);
    expect(second).toContain(".courier/config.json already exists. Use --force to overwrite.");
  });

  it("loads config, reports invalid config, expands home, and adds targets", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);

    expect(expandHome("~/repo", "/tmp/home")).toBe("/tmp/home/repo");

    const added = await targetAddCommand(source, "library-project", target);
    expect(added).toContain('Added target "library-project"');

    const config = await loadConfig(source);
    expect(config.targets["library-project"].path).toBe(target);

    const listed = await targetsCommand(source);
    expect(listed).toContain("library-project");
    expect(listed).toContain("status: missing inbox");

    await expect(targetAddCommand(source, "library-project", target)).rejects.toThrow(CourierError);

    await fs.writeFile(workspacePaths(source).configPath, JSON.stringify({ targets: { bad: {} } }), "utf8");
    await expect(loadConfig(source)).rejects.toThrow("Invalid .courier/config.json");
  });

  it("reports a missing target clearly", async () => {
    const source = await mkdir("source");
    await initWorkspace(source);

    await expect(sendCommand(source, { to: "rig", message: "hello" })).rejects.toThrow(
      'Target "rig" was not found in .courier/config.json.'
    );
  });
});

describe("handoff workflow", () => {
  it("runs the complete send, receive, ack, done, and sender status loop", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await targetAddCommand(source, "library-project", target);

    const sent = await sendCommand(source, {
      to: "library-project",
      title: "Auth helper fails",
      message: "The auth helper fails when the token is empty."
    });
    const id = idFromSend(sent);
    const handoffPath = fileFromSend(sent);

    expect(sent).toContain("courier inbox");
    expect(sent).toContain(`courier read ${id}`);
    await expect(fs.stat(handoffPath)).resolves.toBeTruthy();
    await expect(fs.stat(path.join(source, ".courier", "sent", `${id}.json`))).resolves.toBeTruthy();

    const inbox = await inboxCommand(target);
    expect(inbox).toContain("Inbox");
    expect(inbox).toContain("new");
    expect(inbox).toContain("Auth helper fails");

    const read = await readCommand(target, id.slice(0, 18));
    expect(read).toContain("# Courier Handoff: Auth helper fails");
    expect(read).toContain("## Status\n\nnew");

    const ack = await ackCommand(target, id, "Will inspect today.");
    expect(ack).toContain("Acknowledged handoff");
    expect(await sentCommand(source)).toContain("status: acknowledged");

    const afterAck = await readHandoffFile(handoffPath);
    expect(afterAck.metadata.status).toBe("acknowledged");
    expect(afterAck.markdown).toContain("## Status\n\nacknowledged");
    expect(afterAck.metadata.history.at(-1)?.note).toBe("Will inspect today.");

    const done = await doneCommand(target, id, "Fixed in commit abc123.");
    expect(done).toContain("Completed handoff");
    expect(await inboxCommand(target)).toBe("No active handoffs.");
    expect(await inboxCommand(target, true)).toContain("done");

    const senderStatus = await statusCommand(source, id);
    expect(senderStatus).toContain("status:  done");
    expect(senderStatus).toContain("to:      library-project");

    const receiverStatus = await statusCommand(target, id);
    expect(receiverStatus).toContain("status:  done");
    expect(receiverStatus).toContain("from:");
  });

  it("supports ambiguous prefix errors", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await targetAddCommand(source, "library-project", target);
    const first = idFromSend(await sendCommand(source, { to: "library-project", title: "First", message: "one" }));
    await sendCommand(source, { to: "library-project", title: "Second", message: "two" });

    await expect(readCommand(target, first.slice(0, 4))).rejects.toThrow("Handoff id prefix is ambiguous");
  });

  it("reports missing target handoff paths from sender status", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await targetAddCommand(source, "library-project", target);
    const sent = await sendCommand(source, { to: "library-project", title: "Missing file", message: "check" });
    const id = idFromSend(sent);
    await fs.rm(fileFromSend(sent));

    const output = await sentCommand(source);
    expect(output).toContain("status: missing");
    expect(await statusCommand(source, id)).toContain("status:  missing");
  });
});

describe("attachments", () => {
  it("copies and embeds small text files", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await targetAddCommand(source, "library-project", target);
    await fs.writeFile(path.join(source, "error.log"), "stack trace\nline 2\n", "utf8");

    const sent = await sendCommand(source, { to: "library-project", title: "Failure log", file: "error.log" });
    const id = idFromSend(sent);
    const markdown = await fs.readFile(fileFromSend(sent), "utf8");

    await expect(fs.stat(path.join(target, ".courier", "attachments", id, "error.log"))).resolves.toBeTruthy();
    expect(markdown).toContain("- Embedded: yes");
    expect(markdown).toContain("stack trace");
  });

  it("copies but does not embed large files or binary-looking files", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await targetAddCommand(source, "library-project", target);

    await fs.writeFile(path.join(source, "large.log"), "a".repeat(101 * 1024), "utf8");
    const large = await sendCommand(source, { to: "library-project", title: "Large log", file: "large.log" });
    expect(await fs.readFile(fileFromSend(large), "utf8")).toContain("file exceeded the embed size limit");

    await fs.writeFile(path.join(source, "image.bin"), Buffer.from([0, 1, 2, 3, 4]));
    const binary = await sendCommand(source, { to: "library-project", title: "Binary", file: "image.bin" });
    expect(await fs.readFile(fileFromSend(binary), "utf8")).toContain("file appears to be binary");
  });

  it("supports message plus file and parses attachment frontmatter", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await targetAddCommand(source, "library-project", target);
    await fs.writeFile(path.join(source, "note.txt"), "attached note", "utf8");

    const sent = await sendCommand(source, {
      to: "library-project",
      title: "Message and file",
      message: "Please inspect this file.",
      file: "note.txt"
    });
    const markdown = await fs.readFile(fileFromSend(sent), "utf8");
    const { data } = parseFrontmatter(markdown);

    expect(markdown).toContain("Please inspect this file.");
    expect(Array.isArray(data.attachments)).toBe(true);
  });
});

describe("reserved modes", () => {
  it("treats prefill and auto as manual behavior with a warning", async () => {
    const source = await mkdir("source");
    const target = await mkdir("target");
    await initWorkspace(source);
    await writeConfig(source, {
      targets: {
        future: {
          path: target,
          inbox: ".courier/inbox",
          mode: "auto"
        }
      }
    });

    const output = await sendCommand(source, { to: "future", message: "manual only" });
    expect(output).toContain('Warning: target mode "auto" is reserved; using manual behavior.');
    expect(output).toContain("Sent handoff");
  });
});
