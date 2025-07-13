import { Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { getDotfilesEntries, DOTFILES_ROOT } from "../utils/fs";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";
import path from "node:path";
import { formatText } from "../utils/logger";

export const update = Command.make("update", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			formatText(
				`
┌─────────────────────────────────────────┐
│               Loom Update               │
└─────────────────────────────────────────┘`,
				{ bold: true, color: "blue" },
			) + "\n",
		);

		yield* Effect.logInfo("• Preparing to mend Git-managed patterns...");

		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		let updatedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.source?.trim()) {
				const entryPath = path.resolve(DOTFILES_ROOT, entry);

				yield* Effect.logInfo(
					`  • Mending pattern: ${formatText(entry, { color: "magenta" })}...`,
				);

				yield* Effect.tryPromise({
					try: () => EXEC("git pull", { cwd: entryPath }),
					catch: (cause) =>
						new ExecCommandError({
							command: `git pull in ${entryPath}`,
							cause,
						}),
				}).pipe(
					Effect.tap(() =>
						Effect.gen(function* () {
							yield* Effect.logInfo(
								formatText(
									`    ✓ Pattern '${formatText(entry, { color: "magenta" })}' mended.`,
									{ color: "green", bold: true },
								),
							);
							updatedCount++;
						}),
					),
					Effect.catchAll((err) =>
						Effect.gen(function* () {
							yield* Effect.logError(
								`    ✗ Snag detected while mending '${formatText(entry, { color: "magenta" })}': ${err.message}`,
							);
							errorCount++;
						}),
					),
				);
			} else {
				yield* Effect.logInfo(
					`  • Skipping '${formatText(entry, { color: "magenta" })}': not a Git-managed pattern or missing dotfile.`,
				);
				skippedCount++;
			}
		}

		yield* Effect.logInfo(
			formatText(
				`\n─────────────────────────────────────────\nMending Report:`,
				{ bold: true, color: "blue" },
			),
		);

		yield* Effect.logInfo(
			formatText(`✓ ${updatedCount} patterns successfully mended.`, {
				color: "green",
				bold: true,
			}),
		);

		if (errorCount > 0) {
			yield* Effect.logError(`✗ ${errorCount} snags detected.`);
		}

		if (skippedCount > 0) {
			yield* Effect.logWarning(`• ${skippedCount} patterns skipped.`);
		}

		if (errorCount === 0) {
			yield* Effect.logInfo(
				formatText("\nAll active Git patterns are up to date.", {
					color: "green",
					bold: true,
				}),
			);
		} else {
			yield* Effect.logError(
				"\nSome patterns could not be mended. Please review the snags above.",
			);
		}
	});
}
