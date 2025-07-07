import { Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { LogStyles } from "../utils/log";
import { getDotfilesEntries, DOTFILES_ROOT } from "../utils/fs";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";
import path from "node:path";
import { taskUI } from "../utils/ui";

export const update = Command.make("update", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const root = taskUI.start("Update remote entries");

		const readConfigId = taskUI.start("Read config", root);
		const configEntries = yield* readConfig();
		taskUI.complete(readConfigId);

		const getEntriesId = taskUI.start("Get dotfiles entries", root);
		const dotfilesEntries = yield* getDotfilesEntries();
		taskUI.complete(getEntriesId);

		for (const [entry, data] of Object.entries(configEntries)) {
			const entryId = taskUI.start(entry, root);
			if (dotfilesEntries.includes(entry) && data.source?.trim()) {
				yield* Effect.tryPromise({
					try: () =>
						EXEC(`cd ${path.resolve(DOTFILES_ROOT, entry)} && git pull`),
					catch: (cause) =>
						new ExecCommandError({
							command: `cd ${path.resolve(DOTFILES_ROOT, entry)} && git pull`,
							cause,
						}),
				});

				taskUI.complete(entryId);
			}
		}
		taskUI.complete(root);
		taskUI.logFinalMessage(LogStyles.success("Successfully updated entries"));
	});
}
