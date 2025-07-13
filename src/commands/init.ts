import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import fs from "node:fs/promises";
import { DOTFILES_ROOT, CONFIG_PATH } from "../utils/fs";
import { MakeDirectoryError, WriteFileError } from "../errors";
import { formatText, LogStyles } from "../utils/log";
import { taskUI } from "../utils/ui";

export const init = Command.make("init", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Console.log(
			`
██       ██████   ██████  ███    ███
██      ██    ██ ██    ██ ████  ████
██      ██    ██ ██    ██ ██ ████ ██
██      ██    ██ ██    ██ ██  ██  ██
███████  ██████   ██████  ██      ██
\n
    `,
		);

		const root = taskUI.start(formatText("Initialize Loom", { bold: true }));

		const rootExistsId = taskUI.start("Check root path");
		const rootExists = yield* Effect.tryPromise({
			try: () =>
				fs
					.stat(DOTFILES_ROOT)
					.then(() => true)
					.catch(() => false),
			catch: () => false,
		});
		taskUI.complete(rootExistsId);

		const configExistsId = taskUI.start("Check config path");
		const configExists = yield* Effect.tryPromise({
			try: () =>
				fs
					.stat(CONFIG_PATH)
					.then(() => true)
					.catch(() => false),
			catch: () => false,
		});
		taskUI.complete(configExistsId);

		if (rootExists && configExists) {
			return taskUI.logFinalMessage(
				LogStyles.warning("Skipping initialization: Loom is already set up"),
			);
		}

		const createRootId = taskUI.start("Create root directory", root);
		yield* Effect.tryPromise({
			try: () => fs.mkdir(DOTFILES_ROOT, { recursive: true }),
			catch: (cause) => new MakeDirectoryError({ path: DOTFILES_ROOT, cause }),
		}).pipe(
			Effect.catchTag("MakeDirectoryError", (err) =>
				Effect.gen(function* () {
					taskUI.logFinalMessage(
						LogStyles.error(`Creating root directory failed: ${err.cause}`),
					),
						yield* Effect.fail(err);
				}),
			),
		);
		taskUI.complete(createRootId);

		const createConfigId = taskUI.start("Create Loom config file", root);
		yield* Effect.tryPromise({
			try: () => fs.writeFile(CONFIG_PATH, "", { flag: "wx" }),
			catch: (cause) => new WriteFileError({ path: CONFIG_PATH, cause }),
		}).pipe(
			Effect.catchTag("WriteFileError", (err) =>
				Effect.gen(function* () {
					taskUI.logFinalMessage(
						LogStyles.error(`Creating config file failed: ${err.message}`),
					);
					yield* Effect.fail(err);
				}),
			),
		);
		taskUI.complete(createConfigId);
		taskUI.complete(root);

		taskUI.logFinalMessage(
			LogStyles.success(`Successfully initialized Loom at: '${DOTFILES_ROOT}'`),
		);
	});
}
