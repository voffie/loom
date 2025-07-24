import { Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { getDotfilesEntries, unlinkEntry } from "../utils/fs";
import { formatText } from "../utils/logger";
import fs from "node:fs/promises";
import { createOperationReporter } from "../utils/reporting";

export const unlink = Command.make("unlink", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo("Preparing to unweave symlinks...");
		const reporter = createOperationReporter({
			unweaved: "Unweaved",
			skipped: "Skipped",
			snags: "Snags",
			operationType: "Threads",
		});

		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const symlink = data.target.trim();

				yield* Effect.logInfo(
					`Checking thread: ${formatText(entry, { color: "magenta" })}`,
				);

				const maybeSymlink = yield* Effect.tryPromise(() =>
					fs.lstat(symlink),
				).pipe(
					Effect.catchAll(() =>
						Effect.gen(function* () {
							yield* Effect.logWarning(
								`Symlink '${formatText(symlink, { color: "magenta" })}' for '${formatText(entry, { color: "magenta" })}' not found. Skipping unweave.`,
							);
							reporter.increment("skipped");
							return null;
						}),
					),
				);

				if (maybeSymlink?.isSymbolicLink()) {
					yield* unlinkEntry(symlink).pipe(
						Effect.tap(() => {
							reporter.increment("unweaved");
							return Effect.logInfo(
								formatText(
									`Successfully unweaved symlink for '${formatText(entry, { color: "magenta" })}'.`,
									{ color: "green", bold: true },
								),
							);
						}),
						Effect.catchAll((err) => {
							reporter.increment("snags");
							return Effect.logError(
								`Failed to unweave symlink for '${formatText(entry, { color: "magenta" })}': ${err.message}`,
							);
						}),
					);
				} else if (maybeSymlink) {
					yield* Effect.logWarning(
						`Path '${formatText(symlink, { color: "magenta" })}' for '${formatText(entry, { color: "magenta" })}' exists but is not a symlink. Skipping unweave.`,
					);
					reporter.increment("skipped");
				}
			} else {
				yield* Effect.logWarning(
					`Skipping '${formatText(entry, { color: "magenta" })}': missing dotfile or invalid target pattern.`,
				);
				reporter.increment("skipped");
			}
		}

		yield* reporter.logSummary();
	});
}
