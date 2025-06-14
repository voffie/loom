import { Console, Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { getDotfilesEntries, unsymlinkEntry } from "../utils/fs";
import { coloredText } from "../utils/color";
import fs from "node:fs/promises";

export const unlink = Command.make("unlink", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.target.trim()) {
				const symlink = data.target.trim();

				yield* Console.log(
					coloredText(`\nTrying to unlink '${symlink}'`, "magenta"),
				);

				const maybeSymlink = yield* Effect.tryPromise(() =>
					fs.lstat(symlink),
				).pipe(
					Effect.catchAll(() =>
						Effect.gen(function* () {
							yield* Console.log(
								coloredText(`Failed to locate symlink: '${symlink}'`, "red"),
							);
							return null;
						}),
					),
				);

				if (maybeSymlink && maybeSymlink.isSymbolicLink()) {
					yield* unsymlinkEntry(symlink);
					yield* Console.log(
						coloredText(`Successfully unlinked: ${entry}`, "green"),
					);
				}
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
