import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import fs from "node:fs/promises";
import path from "node:path";

export const init = Command.make("init", {}, () => execute());

function execute() {
	const home = process.env.HOME ?? "~";
	const resolved = "~/.dotfiles".replace(/^~(?=$|\/)/, home);
	const loomTomlPath = path.join(resolved, "loom.toml");

	return Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => fs.mkdir(resolved, { recursive: true }),
			catch: (err) => new Error(`Failed to create directory ${err}`),
		});

		yield* Effect.tryPromise({
			try: () =>
				fs.writeFile(loomTomlPath, generateExampleToml(), { flag: "wx" }),
			catch: (err) =>
				new Error(`Failed to write loom.toml (it might already exist): ${err}`),
		});

		return yield* Console.log(`Initialized Loom at ${resolved}`);
	});
}

function generateExampleToml() {
	return `
[settings]
dotfiles_dir = "~/.dotfiles"

[nvim]
source = "nvim-lua/kickstart.nvim"
target = "~/.config/nvim"

[zsh]
source = "~/dev/zsh-config"
target = "~/.zshrc"
`.trimStart();
}
