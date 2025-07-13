import { Effect } from "effect";
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
import { formatText } from "./logger";
import type { LoomConfig } from "../types";

export function readConfig() {
	return Effect.gen(function* () {
		const contents = yield* Effect.tryPromise({
			try: () => fs.readFile(CONFIG_PATH),
			catch: (cause) => new ReadFileError({ path: CONFIG_PATH, cause }),
		});

		return TOML.parse(contents.toString()) as LoomConfig;
	});
}

function writeConfig(config: string) {
	return Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => fs.writeFile(CONFIG_PATH, config),
			catch: (cause) => new WriteFileError({ path: CONFIG_PATH, cause }),
		});
	});
}

export function writeEntry(source: string, as: string, isLocal: boolean) {
	return Effect.gen(function* () {
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
				Prompt.select({
					message: `
A configuration entry for '${formatText(as, { color: "magenta", bold: true })}' already exists.
${formatText("WARNING", { color: "yellow", bold: true })}: Proceeding will replace the existing entry and unlink its current target.
What would you like to do?`, // Clearer question
					choices: [
						{
							title: formatText("Override (replace existing entry)", {
								color: "red",
								bold: true,
							}),
							value: "y",
						},
						{
							title: formatText("Cancel (keep current entry)", {
								color: "cyan",
								bold: true,
							}),
							value: "n",
						},
					],
				}),
			);

			if (override === "n") {
				yield* Effect.logInfo(
					formatText(`Action cancelled. Entry '${as}' was not updated.`, {
						color: "yellow",
						bold: true,
					}),
				);
				return yield* Effect.fail(new UserDeniedOverrideError());
			}

			yield* removeDotfileEntry(as).pipe(
				Effect.tap(() =>
					Effect.logInfo(
						`  • Cleared existing dotfile for '${formatText(as, { color: "magenta" })}' before override.`,
					),
				),
				Effect.catchAll((err) =>
					Effect.logWarning(
						`  • Could not fully clear old dotfile for '${formatText(as, { color: "magenta" })}' before override: ${err.message}. Proceeding anyway.`,
					),
				),
			);

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
		const config = yield* readConfig();

		if (config[name] !== undefined) {
			delete config[name];
			yield* writeConfig(TOML.stringify(config));
		} else {
			yield* Effect.logWarning(
				`Config entry '${name}' not found for removal. No change made to config.`,
			);
		}
	});
}
