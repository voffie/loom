import { Effect, Either } from "effect";
import { Command, Prompt } from "@effect/cli";
import { getDotfilesEntries, removeDotfileEntry } from "../utils/fs";
import { readConfig, writeEntry } from "../utils/config";
import { formatText } from "../utils/logger";
import { DOTFILES_ROOT } from "../utils/fs";
import { createOperationReporter } from "../utils/reporting";

export const prune = Command.make("prune", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			`Checking for unmanaged patterns in ${formatText(DOTFILES_ROOT, { color: "magenta" })}...`,
		);
		const reporter = createOperationReporter({
			removed: "Removed",
			kept: "Kept",
			written: "Written",
			operationType: "Scanned",
		});

		const dotfilesEntries = yield* getDotfilesEntries();
		const configEntries = yield* readConfig();

		if (dotfilesEntries.length === 0) {
			return yield* Effect.logWarning(
				`No dotfile patterns found in ${formatText(DOTFILES_ROOT, { color: "magenta" })} to prune.`,
			);
		}

		yield* Effect.logInfo("Processing each dotfile pattern");

		for (const entry of dotfilesEntries) {
			if (configEntries[entry] === undefined) {
				const option = yield* Prompt.run(
					Prompt.select({
						message: `Found unmanaged pattern: '${formatText(entry, { color: "magenta" })}'.\nWhat would you like to do?`,
						choices: [
							{
								title: formatText("Remove", { color: "red", bold: true }),
								value: "remove",
								description: `Permanently unweave '${entry}' from Loom's threads.`,
							},
							{
								title: formatText("Keep", { color: "yellow", bold: true }),
								value: "keep",
								description: `Leave '${entry}' unmanaged but in place.`,
							},
							{
								title: formatText("Weave", { color: "green", bold: true }),
								value: "weave",
								description: `Add '${entry}' as a new pattern to your config.`,
							},
						],
					}),
				);

				if (option === "remove") {
					yield* Effect.logError(
						`Unweaving '${formatText(entry, { color: "magenta" })}'...`,
					);

					const removeResult = yield* removeDotfileEntry(entry).pipe(
						Effect.either,
					);

					if (Either.isLeft(removeResult)) {
						yield* Effect.logError(
							`Failed to unweave '${formatText(entry, { color: "magenta" })}': ${removeResult.left.message}`,
						);
						continue;
					}

					yield* Effect.logInfo(
						formatText(
							`Successfully unweaved pattern: '${formatText(entry, { color: "magenta" })}'.`,
							{ color: "green", bold: true },
						),
					);
					reporter.increment("removed");
				} else if (option === "keep") {
					yield* Effect.logWarning(
						`Keeping '${formatText(entry, { color: "magenta" })}'. It remains an unmanaged thread.`,
					);
					reporter.increment("kept");
				} else if (option === "weave") {
					yield* Effect.logInfo(
						`Weaving new config entry for '${formatText(entry, { color: "magenta" })}'...`,
					);

					// TODO: Write propper error handling
					const writeResult = yield* writeEntry("", entry, true).pipe(
						Effect.either,
					);

					if (Either.isLeft(writeResult)) {
						yield* Effect.logError(
							`Failed to unweave '${formatText(entry, { color: "magenta" })}': ${writeResult.left.message}`,
						);
						continue;
					}

					yield* Effect.logInfo(
						formatText(
							`Added new pattern for: '${formatText(entry, { color: "magenta" })}'.\n` +
								`${formatText("Tip: If this is a Git-managed pattern, update its source in the config file:", { color: "cyan" })}\n` +
								`${formatText("[entry_name]", { color: "magenta" })} \n` +
								`${formatText('source = "[username]/[repo]"', { color: "magenta" })}`,
							{ color: "green", bold: true },
						),
					);
					reporter.increment("written");
				}
			} else {
				yield* Effect.logInfo(
					`Pattern '${formatText(entry, { color: "magenta" })}' is already managed. Skipping.`,
				);
			}
		}

		yield* reporter.logSummary();
	});
}
