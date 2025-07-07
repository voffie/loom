import { Console, Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { formatText, LogStyles } from "../utils/log";
import path from "node:path";
import fs from "node:fs/promises";
import {
	DOTFILES_ROOT,
	getDotfilesEntries,
	symlinkEntry,
	unsymlinkEntry,
} from "../utils/fs";
import { taskUI } from "../utils/ui";

export const link = Command.make("link", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const root = taskUI.start(formatText("Symlink entries", { bold: true }));

		const readConfigId = taskUI.start("Read config", root);
		const configEntries = yield* readConfig();
		taskUI.complete(readConfigId);

		const getEntriesId = taskUI.start("Get dotfiles entries", root);
		const dotfilesEntries = yield* getDotfilesEntries();
		taskUI.complete(getEntriesId);

		const symlinkRootId = taskUI.start("Symlink", root);
		for (const [entry, data] of Object.entries(configEntries)) {
			const symlinkId = taskUI.start(entry, symlinkRootId);
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const pointer = path.resolve(DOTFILES_ROOT, entry);
				const symlink = data.target.trim();

				const symlinkExists = yield* Effect.tryPromise({
					try: () =>
						fs
							.lstat(symlink)
							.then(() => true)
							.catch(() => false),
					catch: () => false,
				});

				if (symlinkExists) yield* unsymlinkEntry(symlink);

				yield* symlinkEntry(pointer, symlink);
			} else {
				yield* Console.log(
					LogStyles.warning(
						`Skipping '${entry}' - missing dotfile or invalid target`,
					),
				);
			}
			taskUI.complete(symlinkId);
		}
		taskUI.complete(symlinkRootId);
		taskUI.complete(root);
		taskUI.logFinalMessage(LogStyles.success("Successfully symlinked entries"));
	});
}
