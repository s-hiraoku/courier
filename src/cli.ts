#!/usr/bin/env node
import { Command } from "commander";
import { CourierError } from "./errors.js";
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
} from "./courier.js";

const program = new Command();

program
  .name("courier")
  .description("A local-first CLI for cross-workspace handoffs.")
  .version("0.1.0");

program
  .command("init")
  .option("--force", "overwrite .courier/config.json")
  .action(run(async (options: { force?: boolean }) => initWorkspace(process.cwd(), Boolean(options.force))));

const target = program.command("target");
target
  .command("add")
  .argument("<name>")
  .argument("<path>")
  .option("--force", "overwrite an existing target")
  .action(run(async (name: string, targetPath: string, options: { force?: boolean }) => targetAddCommand(process.cwd(), name, targetPath, Boolean(options.force))));

program.command("targets").action(run(async () => targetsCommand(process.cwd())));

program
  .command("send")
  .argument("[message]")
  .requiredOption("--to <target>", "target name")
  .option("--title <title>", "handoff title")
  .option("--file <path>", "file to attach")
  .action(
    run(async (message: string | undefined, options: { to: string; title?: string; file?: string }) =>
      sendCommand(process.cwd(), { to: options.to, title: options.title, file: options.file, message })
    )
  );

program
  .command("inbox")
  .option("--all", "include done handoffs")
  .action(run(async (options: { all?: boolean }) => inboxCommand(process.cwd(), Boolean(options.all))));

program.command("read").argument("<handoff-id>").action(run(async (id: string) => readCommand(process.cwd(), id)));

program
  .command("ack")
  .argument("<handoff-id>")
  .option("--note <note>", "history note")
  .action(run(async (id: string, options: { note?: string }) => ackCommand(process.cwd(), id, options.note)));

program
  .command("done")
  .argument("<handoff-id>")
  .option("--note <note>", "history note")
  .action(run(async (id: string, options: { note?: string }) => doneCommand(process.cwd(), id, options.note)));

program.command("sent").action(run(async () => sentCommand(process.cwd())));
program.command("status").argument("<handoff-id>").action(run(async (id: string) => statusCommand(process.cwd(), id)));

function run<T extends unknown[]>(handler: (...args: T) => Promise<string>) {
  return async (...args: T) => {
    try {
      const output = await handler(...args);
      if (output) console.log(output);
    } catch (error) {
      if (error instanceof CourierError) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  };
}

await program.parseAsync();
