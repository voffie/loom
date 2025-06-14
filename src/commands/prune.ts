import { Console, Effect } from "effect";
import { Command, Prompt } from "@effect/cli";
import { getDotfilesEntries, removeDotfileEntry } from "../utils/fs";
import { readConfig, writeEntry } from "../utils/config";
import { coloredText } from "../utils/color";

export const prune = Command.make("prune", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		const dotfilesEntries = yield* getDotfilesEntries();
		yield* Console.log(coloredText("Processing dotfile entries...", "cyan"));
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
						`Found: "${coloredText(entry, "cyan")}", but no config entry!\n\nWhat would you like to do?\n` +
						`${coloredText("[r] Remove", "red")}: Permanently delete "${entry}" from ~/.dotfiles\n` +
						`${coloredText("[k] Keep", "yellow")}: Leave it alone and do nothing\n` +
						`${coloredText("[w] Write", "green")}: Add a new config entry for "${entry}"\n\n` +
						`Enter your choice (r/k/w):`,
					validate: (value) =>
						["r", "k", "w"].includes(value.toLowerCase())
							? Effect.succeed(value.toLowerCase())
							: Effect.fail("Invalid option. Please enter 'r', 'k', or 'w'."),
				}),
			);

			if (option === "r") {
				yield* Console.log(
					coloredText(`Removing ${entry} from ~/.dotfiles...`, "red"),
				);
				yield* removeDotfileEntry(entry);
				yield* Console.log(
					coloredText(
						`Successfully removed the dotfile entry: ${entry}\n`,
						"green",
					),
				);
			} else if (option === "k") {
				yield* Console.log(
					coloredText(
						`Keeping ${entry}. It will remain unmanaged.\n`,
						"yellow",
					),
				);
			} else if (option === "w") {
				yield* Console.log(`Writing new config entry for ${entry}...`);
				yield* writeEntry("", entry, true);
				yield* Console.log(
					coloredText(
						`Added a config entry for: ${entry}.\n` +
							"If this is a Git-managed directory, add a 'source' key to the entry using the following format:\n" +
							'source = "[username]/[repo]"\n',
						"green",
					),
				);
			}
		} else {
			yield* Console.log(
				coloredText(`Entry "${entry}" already managed. Skipping.\n`, "yellow"),
			);
		}
	});
}
