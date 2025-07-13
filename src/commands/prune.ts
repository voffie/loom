import { Effect } from "effect";
import { Command, Prompt } from "@effect/cli";
import { getDotfilesEntries, removeDotfileEntry } from "../utils/fs";
import { readConfig, writeEntry } from "../utils/config";
import { formatText } from "../utils/logger";
import { DOTFILES_ROOT } from "../utils/fs";

export const prune = Command.make("prune", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			formatText(
				`
┌─────────────────────────────────────────┐
│               Loom Prune                │
└─────────────────────────────────────────┘`,
				{ bold: true, color: "blue" },
			) + "\n",
		);

		yield* Effect.logInfo(
			`• Checking for unmanaged patterns in ${formatText(DOTFILES_ROOT, { color: "magenta" })}...`,
		);

		const dotfilesEntries = yield* getDotfilesEntries();
		const configEntries = yield* readConfig();

		if (dotfilesEntries.length === 0) {
			return yield* Effect.logWarning(
				`• No dotfile patterns found in ${formatText(DOTFILES_ROOT, { color: "magenta" })} to prune.`,
			);
		}

		yield* Effect.logInfo("• Processing each dotfile pattern:");

		let removedCount = 0;
		let keptCount = 0;
		let writtenCount = 0;

		for (const entry of dotfilesEntries) {
			if (configEntries[entry] === undefined) {
				const option = yield* Prompt.run(
					Prompt.select({
						message: `\nFound unmanaged pattern: '${formatText(entry, { color: "magenta" })}'.\nWhat would you like to do?`,
						choices: [
							{
								title: formatText("Remove", { color: "red", bold: true }),
								value: "r",
								description: `Permanently unravel '${entry}' from Loom's threads.`,
							},
							{
								title: formatText("Keep", { color: "yellow", bold: true }),
								value: "k",
								description: `Leave '${entry}' unmanaged but in place.`,
							},
							{
								title: formatText("Weave", { color: "green", bold: true }),
								value: "w",
								description: `Add '${entry}' as a new pattern to your config.`,
							},
						],
					}),
				);

				if (option === "r") {
					yield* Effect.logError(
						`  • Unraveling '${formatText(entry, { color: "magenta" })}'...`,
					);

					yield* removeDotfileEntry(entry);

					yield* Effect.logInfo(
						formatText(
							`  ✓ Successfully unraveled pattern: '${formatText(entry, { color: "magenta" })}'.`,
							{ color: "green", bold: true },
						),
					);
					removedCount++;
				} else if (option === "k") {
					yield* Effect.logWarning(
						`  • Keeping '${formatText(entry, { color: "magenta" })}'. It remains an unmanaged thread.`,
					);
					keptCount++;
				} else if (option === "w") {
					yield* Effect.logInfo(
						`  • Weaving new config entry for '${formatText(entry, { color: "magenta" })}'...`,
					);

					yield* writeEntry("", entry, true);

					yield* Effect.logInfo(
						formatText(
							`  ✓ Added new pattern for: '${formatText(entry, { color: "magenta" })}'.\n` +
								`    ${formatText("Tip: If this is a Git-managed pattern, update its source in the config file:", { color: "cyan" })}\n` +
								`      ${formatText("[entry_name]", { color: "magenta" })} \n` +
								`      ${formatText('source = "[username]/[repo]"', { color: "magenta" })} \n`,
							{ color: "green", bold: true },
						),
					);
					writtenCount++;
				}
			} else {
				yield* Effect.logInfo(
					`  • Pattern '${formatText(entry, { color: "magenta" })}' is already managed. Skipping.`,
				);
			}
		}

		yield* Effect.logInfo(
			formatText(
				`\n─────────────────────────────────────────\nPruning Report:`,
				{ bold: true, color: "blue" },
			),
		);

		if (removedCount > 0) {
			yield* Effect.logError(`✗ ${removedCount} unmanaged patterns unraveled.`);
		}

		if (keptCount > 0) {
			yield* Effect.logWarning(`• ${keptCount} patterns kept unmanaged.`);
		}

		if (writtenCount > 0) {
			yield* Effect.logInfo(
				formatText(`✓ ${writtenCount} new patterns woven into config.`, {
					color: "green",
					bold: true,
				}),
			);
		}

		if (removedCount === 0 && keptCount === 0 && writtenCount === 0) {
			yield* Effect.logInfo("All patterns are managed. Nothing to prune.");
		} else {
			yield* Effect.logInfo(
				formatText(
					"\nPruning complete. Your dotfiles are now more organized.",
					{ color: "green", bold: true },
				),
			);
		}
	});
}
