import { promises as fs } from "node:fs";
import { z } from "zod";
import { CourierError } from "./errors.js";
import { workspacePaths } from "./paths.js";

const targetSchema = z.object({
  path: z.string().min(1, "is required"),
  inbox: z.string().optional(),
  mode: z.enum(["manual", "prefill", "auto"]).optional()
});

const configSchema = z.object({
  targets: z.record(targetSchema)
});

export type CourierTarget = z.infer<typeof targetSchema>;
export type CourierConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: CourierConfig = { targets: {} };

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(root: string): Promise<CourierConfig> {
  const configPath = workspacePaths(root).configPath;
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch {
    throw new CourierError("No .courier/config.json found.\nRun `courier init` first.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CourierError(`Invalid .courier/config.json:\n${detail}`);
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new CourierError(`Invalid .courier/config.json:\n${field} ${issue.message}`);
  }

  return result.data;
}

export async function writeConfig(root: string, config: CourierConfig): Promise<void> {
  const configPath = workspacePaths(root).configPath;
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
