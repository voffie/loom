import { Effect, Either } from "effect";
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
import { createOperationReporter } from "../utils/reporting";

export const link = Command.make("link", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.logInfo("Preparing to weave symlinks...");
		const reporter = createOperationReporter({
			woven: "Woven",
			snags: "Snags",
			skip: "Skipped",
			operationType: "Threads",
		});

		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		for (const [entry, data] of Object.entries(configEntries)) {
			if (!dotfilesEntries.includes(entry) || !data.target.trim()) {
				yield* Effect.logWarning(
					`Skipping '${formatText(entry, { color: "magenta" })}': missing dotfile or invalid target pattern.`,
				);
				reporter.increment("skip");
				continue;
			}

			const pointer = path.resolve(DOTFILES_ROOT, entry);
			const symlink = data.target.trim();

			yield* Effect.logInfo(
				`Processing thread: ${formatText(entry, { color: "magenta" })}`,
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
					`Existing symlink found at ${formatText(symlink, { color: "magenta" })}. Unweaving...`,
				);

				const unlinkResult = yield* unlinkEntry(symlink).pipe(Effect.either);

				if (Either.isLeft(unlinkResult)) {
					yield* Effect.logError(
						`Failed to unweave existing symlink for ${formatText(entry, { color: "magenta" })}: ${unlinkResult.left.message}`,
					);
					reporter.increment("snags");
					continue;
				}
			}

			const symlinkResult = yield* symlinkEntry(pointer, symlink).pipe(
				Effect.either,
			);

			if (Either.isRight(symlinkResult)) {
				reporter.increment("woven");
				yield* Effect.logInfo(
					formatText(
						`Woven symlink: ${formatText(pointer, { color: "magenta" })} -> ${formatText(symlink, { color: "magenta" })}`,
						{ color: "green", bold: true },
					),
				);
			} else {
				reporter.increment("snags");
				yield* Effect.logError(
					`Failed to weave symlink for '${formatText(entry, { color: "magenta" })}': ${symlinkResult.left.message}`,
				);
			}
		}

		yield* reporter.logSummary();
	});
}
