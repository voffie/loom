import { Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { formatText } from "../utils/logger";
import path from "node:path";
import fs from "node:fs/promises";
import {
	DOTFILES_ROOT,
	getDotfilesEntries,
	symlinkEntry,
	unlinkEntry,
} from "../utils/fs";

export const link = Command.make("link", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			formatText(
				`
┌─────────────────────────────────────────┐
│               Loom Link                 │
└─────────────────────────────────────────┘`,
				{ bold: true, color: "blue" },
			) + "\n",
		);

		yield* Effect.logInfo("• Preparing to weave symlinks...");

		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		let successCount = 0;
		let warningCount = 0;
		let errorCount = 0;

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const pointer = path.resolve(DOTFILES_ROOT, entry);
				const symlink = data.target.trim();

				yield* Effect.logInfo(
					`  • Processing thread: ${formatText(entry, { color: "magenta" })}`,
				);

				const symlinkExists = yield* Effect.tryPromise({
					try: () =>
						fs
							.lstat(symlink)
							.then(() => true)
							.catch(() => false),
					catch: () => false,
				});

				if (symlinkExists) {
					yield* Effect.logWarning(
						`    • Existing symlink found at ${formatText(symlink, { color: "magenta" })}. Unraveling...`,
					);

					yield* unlinkEntry(symlink).pipe(
						Effect.catchAll((err) =>
							Effect.gen(function* () {
								yield* Effect.logError(
									`    ✗ Failed to unravel existing symlink for ${formatText(entry, { color: "magenta" })}: ${err.message}`,
								);
								errorCount++;
							}),
						),
					);
				}

				yield* symlinkEntry(pointer, symlink).pipe(
					Effect.tap(() =>
						Effect.logInfo(
							formatText(
								`    ✓ Woven symlink: ${formatText(pointer, { color: "magenta" })} -> ${formatText(symlink, { color: "magenta" })}`,
								{ color: "green", bold: true },
							),
						),
					),
					Effect.tap(() => Effect.sync(() => successCount++)),
					Effect.catchAll((err) =>
						Effect.gen(function* () {
							yield* Effect.logError(
								`    ✗ Failed to weave symlink for '${formatText(entry, { color: "magenta" })}': ${err.message}`,
							);
							errorCount++;
						}),
					),
				);
			} else {
				yield* Effect.logWarning(
					`  • Skipping '${formatText(entry, { color: "magenta" })}': missing dotfile or invalid target pattern.`,
				);
				warningCount++;
			}
		}

		yield* Effect.logInfo(
			formatText(
				`\n─────────────────────────────────────────\nWeaving Report:`,
				{ bold: true, color: "blue" },
			),
		);

		yield* Effect.logInfo(
			formatText(`✓ ${successCount} threads successfully woven.`, {
				color: "green",
				bold: true,
			}),
		);

		if (errorCount > 0) {
			yield* Effect.logError(`✗ ${errorCount} snags detected.`);
		}

		if (warningCount > 0) {
			yield* Effect.logWarning(`• ${warningCount} patterns skipped.`);
		}

		if (errorCount === 0) {
			yield* Effect.logInfo(
				formatText("\nAll active patterns linked.", {
					color: "green",
					bold: true,
				}),
			);
		} else {
			yield* Effect.logError(
				"\nSome patterns could not be linked. Please review the snags above.",
			);
		}
	});
}
