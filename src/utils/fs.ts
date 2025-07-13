import { Effect } from "effect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
	LocalPathError,
	MoveEntryError,
	ReadDirectoriesError,
	RemoveEntryError,
	SymlinkError,
	UnlinkError,
} from "../errors";

export const HOME = process.env.HOME ?? os.homedir();
export const DOTFILES_ROOT = path.resolve(HOME, ".dotfiles");
export const CONFIG_PATH = path.join(DOTFILES_ROOT, "loom.toml");

export function pathExists(source: string) {
	const absolutePath = path.resolve(HOME, source);

	return Effect.tryPromise({
		try: () =>
			fs
				.stat(absolutePath)
				.then(() => true)
				.catch(() => false),
		catch: (cause) =>
			new LocalPathError({
				path: absolutePath,
				cause,
			}),
	});
}

export function addLocalEntry(source: string, as: string) {
	const oldPath = path.resolve(HOME, source);
	const newPath = path.join(DOTFILES_ROOT, as);

	return Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => fs.rename(oldPath, newPath),
			catch: (cause) =>
				new MoveEntryError({ from: oldPath, to: newPath, cause }),
		});
	});
}

export function getDotfilesEntries() {
	const ignore = ["loom.toml", ".DS_Store", ".git"];
	return Effect.tryPromise({
		try: () =>
			fs
				.readdir(DOTFILES_ROOT)
				.then((data) => data.filter((entry) => !ignore.includes(entry))),
		catch: (cause) => new ReadDirectoriesError({ path: DOTFILES_ROOT, cause }),
	});
}

export function removeDotfileEntry(name: string) {
	// Normalize and prevent path traversal
	const entryPath = path.resolve(DOTFILES_ROOT, name);
	const rootPath = path.resolve(DOTFILES_ROOT);

	if (!entryPath.startsWith(rootPath + path.sep) || entryPath === rootPath) {
		return Effect.fail(
			new RemoveEntryError({
				path: entryPath,
				cause:
					"Invalid entry name; path traversal detected or attempting to delete root",
			}),
		);
	}

	return Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => fs.rm(entryPath, { recursive: true, force: true }),
			catch: (cause) => new RemoveEntryError({ path: entryPath, cause }),
		});
	});
}

export function symlinkEntry(pointer: string, symlink: string) {
	return Effect.tryPromise({
		try: () => fs.symlink(pointer, symlink),
		catch: (cause) => new SymlinkError({ cause, pointer, symlink }),
	});
}

export function unlinkEntry(symlink: string) {
	return Effect.tryPromise({
		try: () => fs.unlink(symlink),
		catch: (cause) => new UnlinkError({ cause, symlink }),
	});
}
