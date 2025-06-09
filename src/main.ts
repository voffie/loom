import { Command } from "@effect/cli";
import { Effect } from "effect";
import { NodeContext, NodeRuntime } from "@effect/platform-node";

import { init } from "./commands/init";

const loomCommand = Command.make("loom", {}, () =>
	Effect.succeed(undefined),
).pipe(Command.withSubcommands([init]));

const cli = Command.run(loomCommand, {
	name: "Loom",
	version: "v0.0.1",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
