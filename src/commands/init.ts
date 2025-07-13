import { Command } from "@effect/cli";
import { Effect } from "effect";
import fs from "node:fs/promises";
import { DOTFILES_ROOT, CONFIG_PATH } from "../utils/fs";
import { MakeDirectoryError, WriteFileError } from "../errors";
import { formatText } from "../utils/logger";

export const init = Command.make("init", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			formatText(
				`
██       ██████   ██████  ███    ███
██      ██    ██ ██    ██ ████  ████
██      ██    ██ ██    ██ ██ ████ ██
██      ██    ██ ██    ██ ██  ██  ██
███████  ██████   ██████  ██      ██
    `,
				{ color: "blue", bold: true },
			),
		);

		yield* Effect.logInfo("• Preparing the loom for your dotfiles...");

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
			yield* Effect.logWarning(
				"• Skipping initialization: Loom is already spun.",
			);
			return;
		}

		yield* Effect.logInfo(
			`• Weaving root directory at ${formatText(DOTFILES_ROOT, { color: "magenta" })}`,
		);

		yield* Effect.tryPromise({
			try: () => fs.mkdir(DOTFILES_ROOT, { recursive: true }),
			catch: (cause) => new MakeDirectoryError({ path: DOTFILES_ROOT, cause }),
		}).pipe(
			Effect.catchTag("MakeDirectoryError", (err) =>
				Effect.gen(function* () {
					yield* Effect.logError(
						`✗ Failed to weave root directory: ${err.cause}`,
					);
					yield* Effect.fail(err);
				}),
			),
		);

		yield* Effect.logInfo(
			formatText("✓ Root directory woven.", { color: "green", bold: true }),
		);

		yield* Effect.logInfo(
			`• Spinning config file at ${formatText(CONFIG_PATH, { color: "magenta" })}`,
		);

		yield* Effect.tryPromise({
			try: () => fs.writeFile(CONFIG_PATH, "", { flag: "wx" }),
			catch: (cause) => new WriteFileError({ path: CONFIG_PATH, cause }),
		}).pipe(
			Effect.catchTag("WriteFileError", (err) =>
				Effect.gen(function* () {
					yield* Effect.logError(
						`✗ Failed to spin config file: ${err.message}`,
					);
					yield* Effect.fail(err);
				}),
			),
		);

		yield* Effect.logInfo(
			formatText("✓ Config file spun.", { color: "green", bold: true }),
		);

		yield* Effect.logInfo(
			formatText(
				`\nLoom has been successfully initialized at: ${formatText(DOTFILES_ROOT, { color: "magenta" })}`,
				{ color: "green", bold: true },
			),
		);
	});
}
