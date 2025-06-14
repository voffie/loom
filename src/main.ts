import { Command } from "@effect/cli";
import { Effect } from "effect";
import { NodeContext, NodeRuntime } from "@effect/platform-node";

import { init } from "./commands/init";
import { install } from "./commands/install";
import { link } from "./commands/link";
import { prune } from "./commands/prune";
import { remove } from "./commands/remove";
import { unlink } from "./commands/unlink";
import { update } from "./commands/update";

const loomCommand = Command.make("loom", {}, () =>
	Effect.succeed(undefined),
).pipe(
	Command.withSubcommands([init, install, link, prune, remove, unlink, update]),
);

const cli = Command.run(loomCommand, {
	name: "Loom",
	version: "v0.0.1",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
