import { Console, Effect } from "effect";
import { Command } from "@effect/cli";
import { readConfig } from "../utils/config";
import { coloredText } from "../utils/color";
import { getDotfilesEntries, DOTFILES_ROOT } from "../utils/fs";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";
import path from "node:path";

export const update = Command.make("update", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const configEntries = yield* readConfig();
		const dotfilesEntries = yield* getDotfilesEntries();

		for (const [entry, data] of Object.entries(configEntries)) {
			if (dotfilesEntries.includes(entry) && data.source?.trim()) {
				yield* Console.log(
					coloredText(
						`Updating '${entry}' entry from it's source: ${data.source}`,
						"magenta",
					),
				);

				yield* Effect.tryPromise({
					try: () =>
						EXEC(
							`cd ${path.resolve(DOTFILES_ROOT, entry)} && git pull && cd ..`,
						),
					catch: (cause) =>
						new ExecCommandError({
							command: `cd ${entry} && git pull && cd ..`,
							cause,
						}),
				});

				yield* Console.log(
					coloredText(`Successfully updated ${entry}!`, "green"),
				);
			}
		}
	});
}
