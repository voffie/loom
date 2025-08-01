import { Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { getDotfilesEntries, DOTFILES_ROOT } from "../utils/fs";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";
import path from "node:path";
import { formatText } from "../utils/logger";
import { createOperationReporter } from "../utils/reporting";
import { ensureGitAvailable } from "../utils/git";

export const update = Command.make("update", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* ensureGitAvailable;
		yield* Effect.logInfo("Preparing to mend Git-managed patterns...");
		const reporter = createOperationReporter({
			mended: "Mended",
			skipped: "Skipped",
			snags: "Snags",
			operationType: "Mending",
		});

		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.source?.trim()) {
				const entryPath = path.resolve(DOTFILES_ROOT, entry);

				yield* Effect.logInfo(
					`Mending pattern: ${formatText(entry, { color: "magenta" })}...`,
				);

				yield* Effect.tryPromise({
					try: () => EXEC("git pull", { cwd: entryPath }),
					catch: (cause) =>
						new ExecCommandError({
							command: `git pull in ${entryPath}`,
							cause,
						}),
				}).pipe(
					Effect.tap(() => {
						reporter.increment("mended");
						return Effect.logInfo(
							formatText(
								`Pattern '${formatText(entry, { color: "magenta" })}' mended.`,
								{ color: "green", bold: true },
							),
						);
					}),

					Effect.catchAll((err) => {
						reporter.increment("snags");
						return Effect.logError(
							`Snag detected while mending '${formatText(entry, { color: "magenta" })}': ${err.message}`,
						);
					}),
				);
			} else {
				yield* Effect.logInfo(
					`Skipping '${formatText(entry, { color: "magenta" })}': not a Git-managed pattern or missing dotfile.`,
				);
				reporter.increment("skipped");
			}
		}

		yield* reporter.logSummary();
	});
}
