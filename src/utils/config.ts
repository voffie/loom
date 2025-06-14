import { Console, Effect } from "effect";
import { Prompt } from "@effect/cli";
import * as TOML from "@iarna/toml";
import fs from "node:fs/promises";
import path from "node:path";
import { HOME, CONFIG_PATH, removeDotfileEntry } from "./fs";
import {
	ReadFileError,
	UserDeniedOverrideError,
	WriteFileError,
} from "../errors";
import { coloredText } from "./color";

export function readConfig() {
	return Effect.gen(function* () {
		yield* Console.log(coloredText("Reading config", "blue"));
		const contents = yield* Effect.tryPromise({
			try: () => fs.readFile(CONFIG_PATH),
			catch: (cause) => new ReadFileError({ path: CONFIG_PATH, cause }),
		});

		return TOML.parse(contents.toString());
	});
}

function writeConfig(config: string) {
	return Effect.gen(function* () {
		yield* Console.log(coloredText("Updating config", "blue"));
		yield* Effect.tryPromise({
			try: () => fs.writeFile(CONFIG_PATH, config),
			catch: (cause) => new WriteFileError({ path: CONFIG_PATH, cause }),
		});
		yield* Console.log(coloredText("Config file updated", "green"));
	});
}

export function writeEntry(source: string, as: string, isLocal: boolean) {
	return Effect.gen(function* () {
		yield* Console.log(coloredText("Writing new config entry", "blue"));
		const config = yield* readConfig();

		if (config[as] === undefined) {
			config[as] = isLocal
				? {
						target: path.resolve(HOME, ".config", as),
					}
				: {
						source: source,
						target: path.resolve(HOME, ".config", as),
					};
		} else {
			const override = yield* Prompt.run(
				Prompt.text({
					message: `Found config entry for: ${as}!\n ${coloredText("Warning", "yellow")}: This will replace the old entry with the new one\n Do you want to override the entry? ${coloredText("(y/n)", "red")}`,
					validate: (value) =>
						["y", "n"].includes(value.toLowerCase())
							? Effect.succeed(value.toLowerCase())
							: Effect.fail("Invalid option. Please enter 'y' or 'n'."),
				}),
			);

			if (override === "n") {
				yield* Console.log(
					coloredText(
						`Override denied. Entry ${as} was not updated.\n`,
						"yellow",
					),
				);
				return yield* Effect.fail(new UserDeniedOverrideError());
			}

			yield* removeDotfileEntry(as);

			config[as] = isLocal
				? {
						target: path.resolve(HOME, ".config", as),
					}
				: {
						source: source,
						target: path.resolve(HOME, ".config", as),
					};
		}

		yield* writeConfig(TOML.stringify(config));
	});
}

export function removeEntry(name: string) {
	return Effect.gen(function* () {
		yield* Console.log(coloredText("Removing config entry", "blue"));
		const config = yield* readConfig();

		delete config[name];

		yield* writeConfig(TOML.stringify(config));
	});
}
