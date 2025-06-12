import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import {
	isLocalPath,
	DOTFILES_ROOT,
	expandPath,
	addLocalEntry,
} from "../utils/fs";
import { writeEntry } from "../utils/config";
import path from "node:path";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";

const source = Args.text({ name: "source" });
const as = Options.text("as");
export const install = Command.make(
	"install",
	{ source, as },
	({ source, as }) => execute(source, as),
);

function execute(source: string, as: string) {
	return Effect.gen(function* () {
		const isLocal = yield* isLocalPath(source);

		yield* writeEntry(source, as, isLocal);

		if (isLocal) {
			yield* Console.log(`Detected local source: ${expandPath(source)}`);
			yield* addLocalEntry(source, as);
		} else {
			yield* Console.log(`Cloning git repo: https://github.com/${source}`);
			yield* cloneGitRepo(source, as);
		}

		return yield* Console.log(`Installed ${source} as ${as}`);
	});
}

function cloneGitRepo(source: string, as: string) {
	const targetPath = path.join(DOTFILES_ROOT, as);

	return Effect.tryPromise({
		try: () => EXEC(`git clone https://github.com/${source}.git ${targetPath}`),
		catch: (cause) =>
			new ExecCommandError({
				command: `git clone https://github.com/${source}.git ${targetPath}`,
				cause,
			}),
	});
}
