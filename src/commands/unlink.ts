import { Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { getDotfilesEntries, unlinkEntry } from "../utils/fs";
import { formatText } from "../utils/logger";
import fs from "node:fs/promises";

export const unlink = Command.make("unlink", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			formatText(
				`
┌─────────────────────────────────────────┐
│              Loom Unlink                │
└─────────────────────────────────────────┘`,
				{ bold: true, color: "blue" },
			) + "\n",
		);

		yield* Effect.logInfo("• Preparing to unravel symlinks...");

		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		let successCount = 0;
		let warningCount = 0;
		let errorCount = 0;

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const symlink = data.target.trim();

				yield* Effect.logInfo(
					`  • Checking thread: ${formatText(entry, { color: "magenta" })}`,
				);

				const maybeSymlink = yield* Effect.tryPromise(() =>
					fs.lstat(symlink),
				).pipe(
					Effect.catchAll(() =>
						Effect.gen(function* () {
							yield* Effect.logWarning(
								`    • Symlink '${formatText(symlink, { color: "magenta" })}' for '${formatText(entry, { color: "magenta" })}' not found. Skipping unravel.`,
							);
							warningCount++;
							return null;
						}),
					),
				);

				if (maybeSymlink?.isSymbolicLink()) {
					yield* unlinkEntry(symlink).pipe(
						Effect.tap(() =>
							Effect.gen(function* () {
								yield* Effect.logInfo(
									formatText(
										`    ✓ Successfully unraveled symlink for '${formatText(entry, { color: "magenta" })}'.`,
										{ color: "green", bold: true },
									),
								);
								successCount++;
							}),
						),
						Effect.catchAll((err) =>
							Effect.gen(function* () {
								yield* Effect.logError(
									`    ✗ Failed to unravel symlink for '${formatText(entry, { color: "magenta" })}': ${err.message}`,
								);
								errorCount++;
							}),
						),
					);
				} else if (maybeSymlink) {
					yield* Effect.logWarning(
						`    • Path '${formatText(symlink, { color: "magenta" })}' for '${formatText(entry, { color: "magenta" })}' exists but is not a symlink. Skipping unravel.`,
					);
					warningCount++;
				}
			} else {
				yield* Effect.logWarning(
					`  • Skipping '${formatText(entry, { color: "magenta" })}': missing dotfile or invalid target pattern.`,
				);
				warningCount++;
			}
		}

		yield* Effect.logInfo(
			formatText(
				`\n─────────────────────────────────────────\nUnraveling Report:`,
				{ bold: true, color: "blue" },
			),
		);

		yield* Effect.logInfo(
			formatText(`✓ ${successCount} threads successfully unraveled.`, {
				color: "green",
				bold: true,
			}),
		);

		if (errorCount > 0) {
			yield* Effect.logError(`✗ ${errorCount} snags detected.`);
		}

		if (warningCount > 0) {
			yield* Effect.logWarning(
				`• ${warningCount} patterns skipped or not found.`,
			);
		}

		if (errorCount === 0) {
			yield* Effect.logInfo(
				formatText("\nAll active patterns unlinked.", {
					color: "green",
					bold: true,
				}),
			);
		} else {
			yield* Effect.logError(
				"\nSome patterns could not be unlinked. Please review the snags above.",
			);
		}
	});
}
