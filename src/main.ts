import { Command } from "@effect/cli";
import { Effect, Logger } from "effect";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { logger } from "./utils/logger";

import { init } from "./commands/init";
import { install } from "./commands/install";
import { link } from "./commands/link";
import { prune } from "./commands/prune";
import { remove } from "./commands/remove";
import { unlink } from "./commands/unlink";
import { update } from "./commands/update";

import { version } from "../package.json";

const customLoggerLayer = Logger.replace(Logger.defaultLogger, logger);

const loomCommand = Command.make("loom", {}, () =>
	Effect.succeed(undefined),
).pipe(
	Command.withSubcommands([init, install, link, prune, remove, unlink, update]),
);

const cli = Command.run(loomCommand, {
	name: "Loom",
	version: `v${version}`,
});

cli(process.argv).pipe(
	Effect.provide(customLoggerLayer),
	Effect.provide(NodeContext.layer),
	NodeRuntime.runMain({ disablePrettyLogger: true }),
);
