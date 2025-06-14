import { Console, Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { coloredText } from "../utils/color";
import path from "node:path";
import fs from "node:fs/promises";
import {
	DOTFILES_ROOT,
	getDotfilesEntries,
	symlinkEntry,
	unsymlinkEntry,
} from "../utils/fs";

export const link = Command.make("link", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const pointer = path.resolve(DOTFILES_ROOT, entry);
				const symlink = data.target.trim();

				yield* Console.log(
					coloredText(
						`\nTrying to symlink '${pointer}' to: '${symlink}'`,
						"magenta",
					),
				);

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

				yield* Console.log(
					coloredText(`Successfully symlinked: ${entry}`, "green"),
				);
			} else {
				yield* Console.log(
					coloredText(
						`Skipping '${entry}' - missing dotfile or invalid target`,
						"yellow",
					),
				);
			}
		}
	});
}
