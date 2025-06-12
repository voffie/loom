import { Effect } from "effect";
import fs from "node:fs/promises";
import path from "node:path";
import {
	LocalPathError,
	MoveEntryError,
	ReadDirectoriesError,
	RemoveEntryError,
} from "../errors";

export const HOME = process.env.HOME ?? "~";
export const DOTFILES_ROOT = path.resolve(HOME, ".dotfiles");
export const CONFIG_PATH = path.join(DOTFILES_ROOT, "loom.toml");

export function expandPath(source: string) {
	return source.replace(/^~(?=$|\/)/, HOME);
}

export function isLocalPath(source: string) {
	return Effect.tryPromise({
		try: () =>
			fs
				.stat(path.resolve(HOME, expandPath(source)))
				.then(() => true)
				.catch(() => false),
		catch: (cause) =>
			new LocalPathError({
				path: path.resolve(HOME, expandPath(source)),
				cause,
			}),
	});
}

export function addLocalEntry(source: string, as: string) {
	const oldPath = path.resolve(HOME, source);
	const newPath = path.join(DOTFILES_ROOT, as);

	return Effect.tryPromise({
		try: () => fs.rename(oldPath, newPath),
		catch: (cause) => new MoveEntryError({ from: oldPath, to: newPath, cause }),
	});
}

export function getDotfilesEntries() {
	return Effect.tryPromise({
		try: () => fs.readdir(DOTFILES_ROOT),
		catch: (cause) => new ReadDirectoriesError({ path: DOTFILES_ROOT, cause }),
	});
}

export function removeDotfileEntry(name: string) {
	const entryPath = path.join(DOTFILES_ROOT, name);

	return Effect.gen(function* () {
		yield* Effect.log(`Removing entry for ${name}`);

		yield* Effect.tryPromise({
			try: () => fs.rm(entryPath, { recursive: true }),
			catch: (cause) => new RemoveEntryError({ path: entryPath, cause }),
		});
	});
}
