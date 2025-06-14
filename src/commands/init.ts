import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import fs from "node:fs/promises";
import { DOTFILES_ROOT, CONFIG_PATH } from "../utils/fs";
import { MakeDirectoryError, WriteFileError } from "../errors";
import { coloredText } from "../utils/color";

export const init = Command.make("init", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Console.log(
			coloredText(
				`
██       ██████   ██████  ███    ███
██      ██    ██ ██    ██ ████  ████
██      ██    ██ ██    ██ ██ ████ ██
██      ██    ██ ██    ██ ██  ██  ██
███████  ██████   ██████  ██      ██
\n
    `,
				"cyan",
			),
		);

		yield* Console.log(coloredText("Starting Loom initialization...", "cyan"));

		const rootExists = yield* Effect.tryPromise({
			try: () =>
				fs
					.stat(DOTFILES_ROOT)
					.then(() => true)
					.catch(() => false),
			catch: () => false,
		});

		const configExists = yield* Effect.tryPromise({
			try: () =>
				fs
					.stat(CONFIG_PATH)
					.then(() => true)
					.catch(() => false),
			catch: () => false,
		});

		if (rootExists && configExists) {
			return yield* Console.log(
				coloredText(
					"Skipping initialization: Loom is already set up.",
					"yellow",
				),
			);
		}

		yield* Effect.tryPromise({
			try: () => fs.mkdir(DOTFILES_ROOT, { recursive: true }),
			catch: (cause) => new MakeDirectoryError({ path: DOTFILES_ROOT, cause }),
		});

		yield* Effect.tryPromise({
			try: () => fs.writeFile(CONFIG_PATH, "", { flag: "wx" }),
			catch: (cause) => new WriteFileError({ path: CONFIG_PATH, cause }),
		}).pipe(
			Effect.catchTag("WriteFileError", () =>
				Console.log(coloredText("Config file already initialized", "yellow")),
			),
		);

		return yield* Console.log(
			coloredText(`Initialized Loom at ${DOTFILES_ROOT}`, "green"),
		);
	});
}
