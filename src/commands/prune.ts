import { Console, Effect } from "effect";
import { Command, Prompt } from "@effect/cli";
import { getDotfilesEntries, removeDotfileEntry } from "../utils/fs";
import { readConfig, writeEntry } from "../utils/config";
import { formatText, LogStyles } from "../utils/log";

export const prune = Command.make("prune", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const dotfilesEntries = yield* getDotfilesEntries();

		if (dotfilesEntries.length === 0) {
			return yield* Console.log(LogStyles.warning("No entries found"));
		}

		yield* Console.log(
			formatText("Processing dotfile entries...", { bold: true }),
		);
		yield* Effect.forEach(dotfilesEntries, handleEntry);
	});
}

function handleEntry(entry: string) {
	return Effect.gen(function* () {
		const configEntries = yield* readConfig();
		if (configEntries[entry] === undefined) {
			const option = yield* Prompt.run(
				Prompt.text({
					message:
						`Found: '${formatText(entry, { color: "magenta" })}', but no config entry!\n\nWhat would you like to do?\n` +
						`${LogStyles.error("[r] Remove")}: Permanently delete '${entry}' from ~/.dotfiles\n` +
						`${LogStyles.warning("[k] Keep")}: Leave it alone and do nothing\n` +
						`${LogStyles.success("[w] Write")}: Add a new config entry for '${entry}'\n\n` +
						`Enter your choice (r/k/w):`,
					validate: (value) =>
						["r", "k", "w"].includes(value.toLowerCase())
							? Effect.succeed(value.toLowerCase())
							: Effect.fail("Invalid option. Please enter 'r', 'k', or 'w'."),
				}),
			);

			if (option === "r") {
				yield* Console.log(
					LogStyles.error(`Removing '${entry}' from ~/.dotfiles...`),
				);
				yield* removeDotfileEntry(entry);
				yield* Console.log(
					LogStyles.success(
						`Successfully removed the dotfile entry: '${entry}'\n`,
					),
				);
			} else if (option === "k") {
				yield* Console.log(
					LogStyles.warning(`Keeping '${entry}'. It will remain unmanaged.\n`),
				);
			} else if (option === "w") {
				yield* Console.log(`Writing new config entry for '${entry}'...`);
				yield* writeEntry("", entry, true);
				yield* Console.log(
					LogStyles.success(
						`Added a config entry for: '${entry}'.\n` +
							"If this is a Git-managed directory, add a 'source' key to the entry using the following format:\n" +
							'source = "[username]/[repo]"\n',
					),
				);
			}
		} else {
			yield* Console.log(
				LogStyles.warning(`Entry '${entry}' already managed. Skipping.\n`),
			);
		}
	});
}
