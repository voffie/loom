import { Args, Command } from "@effect/cli";
import { Effect } from "effect";
import path from "node:path";
import { DOTFILES_ROOT, pathExists, removeDotfileEntry } from "../utils/fs";
import { readConfig, removeEntry } from "../utils/config";
import { formatText } from "../utils/logger";

const source = Args.text({ name: "source" });
export const remove = Command.make("remove", { source }, ({ source }) =>
	execute(source),
);

function execute(source: string) {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			`Checking pattern: ${formatText(source, { color: "magenta" })}...`,
		);

		const configEntries = yield* readConfig();

		if (!(source in configEntries)) {
			yield* Effect.logWarning(
				`Pattern '${formatText(source, { color: "magenta" })}' is not found in your Loom configuration. ` +
					`It seems it's not a managed dotfile. Nothing to unweave with this command.\n` +
					`Consider using 'loom prune' to manage or unweave unmanaged files.`,
			);
			return;
		}

		const dotfilePath = path.join(DOTFILES_ROOT, source);
		const dotfileOnDiskExists = yield* pathExists(dotfilePath);

		yield* Effect.logInfo(
			`Unweaving pattern '${formatText(source, { color: "magenta" })}' from config...`,
		);

		yield* removeEntry(source).pipe(
			Effect.tap(() =>
				Effect.logInfo(
					formatText(
						`Pattern '${formatText(source, { color: "magenta" })}' unweaved from config.`,
						{ color: "green", bold: true },
					),
				),
			),
			Effect.catchAll((err) =>
				Effect.gen(function* () {
					yield* Effect.logError(
						`Failed to unweave pattern '${formatText(source, { color: "magenta" })}' from config: ${err.message}. ` +
							`This is a critical error; your config might be corrupted.`,
					);
					yield* Effect.fail(err);
				}),
			),
		);

		if (dotfileOnDiskExists) {
			yield* Effect.logInfo(
				`Unweaving dotfile entry '${formatText(source, { color: "magenta" })}' from disk at ${formatText(dotfilePath, { color: "magenta" })}...`,
			);

			yield* removeDotfileEntry(source).pipe(
				Effect.tapError((err) =>
					Effect.logError(
						`An error occurred while unweaving dotfile '${formatText(source, { color: "magenta" })}' from disk: ${err.message}. ` +
							`You might need to manually unweave ${formatText(dotfilePath, { color: "magenta" })}.`,
					),
				),
				Effect.tap(() =>
					Effect.logInfo(
						formatText(
							`Dotfile entry '${formatText(source, { color: "magenta" })}' unweaved from disk.`,
							{ color: "green", bold: true },
						),
					),
				),
			);
		} else {
			yield* Effect.logWarning(
				`Dotfile entry '${formatText(source, { color: "magenta" })}' not found on disk at ${formatText(dotfilePath, { color: "magenta" })}. ` +
					`It was already unweaved or never existed there.`,
			);
		}

		yield* Effect.logInfo(
			formatText(
				`Successfully unweaved all traces of pattern: '${formatText(source, { color: "magenta" })}'.`,
				{ color: "green", bold: true },
			),
		);
	});
}
