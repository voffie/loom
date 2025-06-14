import { Console, Effect } from "effect";
import fs from "node:fs/promises";
import path from "node:path";
import {
	LocalPathError,
	MoveEntryError,
	ReadDirectoriesError,
	RemoveEntryError,
} from "../errors";
import { coloredText } from "./color";

export const HOME = process.env.HOME ?? "~";
export const DOTFILES_ROOT = path.resolve(HOME, ".dotfiles");
export const CONFIG_PATH = path.join(DOTFILES_ROOT, "loom.toml");

export function isLocalPath(source: string) {
	return Effect.tryPromise({
		try: () =>
			fs
				.stat(path.resolve(HOME, source))
				.then(() => true)
				.catch(() => false),
		catch: (cause) =>
			new LocalPathError({
				path: path.resolve(HOME, source),
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

		yield* Console.log(
			coloredText(`Moved local entry from ${oldPath} to ${newPath}`, "blue"),
		);
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
	const entryPath = path.join(DOTFILES_ROOT, name);

	return Effect.gen(function* () {
		yield* Console.log(coloredText(`Removing entry for ${name}`, "blue"));

		yield* Effect.tryPromise({
			try: () => fs.rm(entryPath, { recursive: true }),
			catch: (cause) => new RemoveEntryError({ path: entryPath, cause }),
		});
	});
}

export function symlinkEntry(pointer: string, symlink: string) {
	return Effect.tryPromise({
		try: () => fs.symlink(pointer, symlink),
		catch: (cause) =>
			Console.log(
				coloredText(`Failed to create symlink '${symlink}':\n${cause}`, "red"),
			),
	});
}

export function unsymlinkEntry(symlink: string) {
	return Effect.tryPromise({
		try: () => fs.unlink(symlink),
		catch: (cause) =>
			Console.log(
				coloredText(`Failed to unlink symlink '${symlink}': ${cause}`, "red"),
			),
	});
}
