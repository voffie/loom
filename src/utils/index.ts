import { Effect } from "effect";
import * as ChildProcess from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import * as TOML from "@iarna/toml";

type LoomConfigEntry = {
	source?: string;
	target: string;
};

export type LoomConfig = {
	[name: string]: LoomConfigEntry;
};

const exec = promisify(ChildProcess.exec);
const home = process.env.HOME ?? "~";
const dotfilesDir = path.resolve(home, ".dotfiles");

export function expandPath(source: string) {
	return source.replace(/^~(?=$|\/)/, home);
}

export function isLocalPath(source: string) {
	return Effect.tryPromise({
		try: () =>
			fs
				.stat(path.resolve(home, expandPath(source)))
				.then(() => true)
				.catch(() => false),
		catch: (err) => new Error(`Error checking file stat: ${err}`),
	});
}

export function moveToDotfiles(source: string, as: string) {
	const targetPath = path.join(dotfilesDir, as);
	const sourcePath = path.resolve(home, source);

	return Effect.tryPromise({
		try: () => fs.rename(sourcePath, targetPath),
		catch: (err) => new Error(`Error moving local file: ${err}`),
	});
}

export function cloneGitRepo(source: string, as: string) {
	const targetPath = path.join(dotfilesDir, as);

	return Effect.tryPromise({
		try: () =>
			exec(`git clone https://github.com/${source}.git ${targetPath}`).then(
				() => undefined,
			),
		catch: (err) => new Error(`Git clone failed: ${err}`),
	});
}

export function updateConfig(source: string, as: string, isLocal: boolean) {
	return Effect.gen(function* () {
		const configPath = path.join(dotfilesDir, "loom.toml");
		const contents = yield* Effect.tryPromise({
			try: () => fs.readFile(configPath),
			catch: (err) => new Error(`Error reading config file: ${err}`),
		});

		const config = TOML.parse(contents.toString());

		const maybeEntry = config[as] as LoomConfigEntry;

		if (config[as] && !isLocal) {
			yield* Effect.log(`Found config entry for: ${as}! Updating it's source!`);
			maybeEntry.source = source;
		} else {
			yield* Effect.log(
				`No config entry found for: ${as}! Creating a new one!`,
			);
			if (!isLocal) {
				config[as] = {
					source,
					target: path.resolve(home, ".config", as),
				};
			} else {
				config[as] = {
					target: path.resolve(home, ".config", as),
				};
			}
		}

		const updatedToml = TOML.stringify(config);

		yield* Effect.tryPromise({
			try: () => fs.writeFile(configPath, updatedToml),
			catch: (err) => new Error(`Error while writing to config file: ${err}`),
		});
	});
}
