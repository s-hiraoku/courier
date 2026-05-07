import os from "node:os";
import path from "node:path";

export const COURIER_DIR = ".courier";
export const CONFIG_FILE = "config.json";
export const DEFAULT_INBOX = ".courier/inbox";

export type CourierPaths = {
  root: string;
  courierDir: string;
  configPath: string;
  inboxDir: string;
  sentDir: string;
  attachmentsDir: string;
};

export function workspacePaths(root: string): CourierPaths {
  const courierDir = path.join(root, COURIER_DIR);
  return {
    root,
    courierDir,
    configPath: path.join(courierDir, CONFIG_FILE),
    inboxDir: path.join(courierDir, "inbox"),
    sentDir: path.join(courierDir, "sent"),
    attachmentsDir: path.join(courierDir, "attachments")
  };
}

export function expandHome(input: string, home = os.homedir()): string {
  if (input === "~") return home;
  if (input.startsWith("~/")) return path.join(home, input.slice(2));
  return input;
}

export function resolveWorkspacePath(input: string, cwd: string): string {
  const expanded = expandHome(input);
  return path.resolve(cwd, expanded);
}

export function targetInboxPath(targetWorkspace: string, inbox = DEFAULT_INBOX): string {
  return path.resolve(targetWorkspace, inbox);
}

export function displayPath(fullPath: string, cwd: string): string {
  const relative = path.relative(cwd, fullPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return fullPath;
  }
  return relative || ".";
}
