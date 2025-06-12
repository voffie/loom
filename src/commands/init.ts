import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import fs from "node:fs/promises";
import { DOTFILES_ROOT, CONFIG_PATH } from "../utils/fs";
import { MakeDirectoryError, WriteFileError } from "../errors";

export const init = Command.make("init", {}, () => execute());

function execute() {
	return Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => fs.mkdir(DOTFILES_ROOT, { recursive: true }),
			catch: (cause) => new MakeDirectoryError({ path: DOTFILES_ROOT, cause }),
		});

		yield* Effect.tryPromise({
			try: () => fs.writeFile(CONFIG_PATH, "", { flag: "wx" }),
			catch: (cause) => new WriteFileError({ path: CONFIG_PATH, cause }),
		});

		return yield* Console.log(`Initialized Loom at ${DOTFILES_ROOT}`);
	});
}
