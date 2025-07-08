import { Console, Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { getDotfilesEntries, unlinkEntry } from "../utils/fs";
import { LogStyles } from "../utils/log";
import fs from "node:fs/promises";
import { taskUI } from "../utils/ui";

export const unlink = Command.make("unlink", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const root = taskUI.start("Unlink entries");

		const readConfigId = taskUI.start("Read config", root);
		const configEntries = yield* readConfig();
		taskUI.complete(readConfigId);

		const getEntriesId = taskUI.start("Get dotfiles entries", root);
		const dotfilesEntries = yield* getDotfilesEntries();
		taskUI.complete(getEntriesId);

		const unlinkRootId = taskUI.start("Unlink", root);
		for (const [entry, data] of Object.entries(configEntries)) {
			const unlinkId = taskUI.start(entry, unlinkRootId);
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const symlink = data.target.trim();

				const maybeSymlink = yield* Effect.tryPromise(() =>
					fs.lstat(symlink),
				).pipe(
					Effect.catchAll(() =>
						Effect.gen(function* () {
							yield* Console.log(
								LogStyles.error(`Failed to locate symlink '${symlink}'`),
							);
							return null;
						}),
					),
				);

				if (maybeSymlink?.isSymbolicLink()) {
					yield* unlinkEntry(symlink).pipe(
						Effect.catchAll((err) =>
							Console.log(
								LogStyles.error(
									`Failed to unlink existing symlink for ${entry}: ${err}`,
								),
							),
						),
					);
				}
			} else {
				yield* Console.log(
					LogStyles.warning(
						`Skipping '${entry}' - missing dotfile or invalid target`,
					),
				);
			}
			taskUI.complete(unlinkId);
		}
		taskUI.complete(unlinkRootId);
		taskUI.complete(root);
		taskUI.logFinalMessage(LogStyles.success("Successfully unlinked entries"));
	});
}
