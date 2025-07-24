import { Effect, Schema } from "effect";
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
import { LoomConfigSchema } from "../types";

export function readConfig() {
	return Effect.gen(function* () {
		const contents = yield* Effect.tryPromise({
			try: () => fs.readFile(CONFIG_PATH),
			catch: (cause) => new ReadFileError({ path: CONFIG_PATH, cause }),
		}).pipe(
			Effect.tapError((_) =>
				Effect.logError(
					"Unable to locate Loom config file. Run 'loom init' to initialize Loom",
				),
			),
		);

		const parsed = TOML.parse(contents.toString());
		return yield* Schema.decodeUnknown(LoomConfigSchema)(parsed).pipe(
			Effect.tapError((_) =>
				Effect.logError(
					"Couldn't parse config file. File content is malformed",
				),
			),
		);
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
					message: `A entry for '${formatText(as, { color: "magenta", bold: true })}' already exists. What would you like to do?`,
					choices: [
						{
							title: formatText("Override", {
								color: "red",
								bold: true,
							}),
							value: "override",
							description: "Replace existing entry",
						},
						{
							title: formatText("Cancel", {
								color: "cyan",
								bold: true,
							}),
							value: "cancel",
							description: "Keep current entry",
						},
					],
				}),
			);

			if (override === "cancel") {
				return yield* Effect.fail(new UserDeniedOverrideError());
			}

			yield* removeDotfileEntry(as).pipe(
				Effect.tap(() =>
					Effect.logInfo(
						`Cleared existing dotfile for '${formatText(as, { color: "magenta" })}' before override.`,
					),
				),
				Effect.catchAll((err) =>
					Effect.logWarning(
						`Could not fully clear old dotfile for '${formatText(as, { color: "magenta" })}' before override: ${err.message}. Proceeding anyway.`,
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
