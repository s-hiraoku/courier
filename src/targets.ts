import { promises as fs } from "node:fs";
import path from "node:path";
import { CourierError } from "./errors.js";
import { loadConfig, writeConfig, pathExists } from "./config.js";
import type { CourierTarget } from "./config.js";
import { DEFAULT_INBOX, resolveWorkspacePath, targetInboxPath } from "./paths.js";

export type ResolvedTarget = {
  name: string;
  path: string;
  inbox: string;
  mode: "manual" | "prefill" | "auto";
};

export async function addTarget(root: string, name: string, targetPath: string, force = false): Promise<ResolvedTarget> {
  const config = await loadConfig(root);
  if (config.targets[name] && !force) {
    throw new CourierError(`Target "${name}" already exists. Use --force to overwrite.`);
  }

  const resolvedPath = resolveWorkspacePath(targetPath, root);
  if (!(await pathExists(resolvedPath))) {
    throw new CourierError(`Target path does not exist:\n${targetPath}`);
  }

  const target: Required<CourierTarget> = {
    path: resolvedPath,
    inbox: DEFAULT_INBOX,
    mode: "manual"
  };
  config.targets[name] = target;
  await writeConfig(root, config);
  return resolveTargetFromConfig(name, target, root);
}

export async function resolveTarget(root: string, name: string): Promise<ResolvedTarget> {
  const config = await loadConfig(root);
  const target = config.targets[name];
  if (!target) {
    const configured = Object.keys(config.targets).sort();
    const suffix = configured.length > 0 ? configured.join(", ") : "(none)";
    throw new CourierError(`Target "${name}" was not found in .courier/config.json.\nConfigured targets: ${suffix}`);
  }
  return resolveTargetFromConfig(name, target, root);
}

export function resolveTargetFromConfig(name: string, target: CourierTarget, root: string): ResolvedTarget {
  const resolvedPath = resolveWorkspacePath(target.path, root);
  return {
    name,
    path: resolvedPath,
    inbox: targetInboxPath(resolvedPath, target.inbox ?? DEFAULT_INBOX),
    mode: target.mode ?? "manual"
  };
}

export async function listTargets(root: string): Promise<Array<ResolvedTarget & { status: string }>> {
  const config = await loadConfig(root);
  const entries = Object.entries(config.targets);
  const targets = await Promise.all(
    entries.map(async ([name, target]) => {
      const resolved = resolveTargetFromConfig(name, target, root);
      let status = "ok";
      try {
        const stat = await fs.stat(resolved.path);
        if (!stat.isDirectory()) {
          status = "missing path";
        } else {
          try {
            const inboxStat = await fs.stat(resolved.inbox);
            status = inboxStat.isDirectory() ? "ok" : "missing inbox";
          } catch {
            status = "missing inbox";
          }
        }
      } catch {
        status = "missing path";
      }
      return { ...resolved, status };
    })
  );
  return targets.sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureTargetWorkspace(target: ResolvedTarget): Promise<void> {
  try {
    const stat = await fs.stat(target.path);
    if (!stat.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new CourierError(`Target path does not exist:\n${target.path}`);
  }
  await fs.mkdir(path.join(target.path, ".courier", "inbox"), { recursive: true });
  await fs.mkdir(path.join(target.path, ".courier", "attachments"), { recursive: true });
}
