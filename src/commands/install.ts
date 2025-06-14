import path from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";
import { isLocalPath, DOTFILES_ROOT, addLocalEntry, HOME } from "../utils/fs";
import { writeEntry } from "../utils/config";
import { coloredText } from "../utils/color";

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
			yield* Console.log(
				coloredText(
					`Detected local source: ${path.resolve(HOME, source)}`,
					"magenta",
				),
			);
			yield* addLocalEntry(source, as);
		} else {
			yield* Console.log(
				coloredText(
					`Cloning git repo: https://github.com/${source}`,
					"magenta",
				),
			);
			yield* cloneGitRepo(source, as);
		}

		return yield* Console.log(
			coloredText(`Installed ${source} as ${as}`, "green"),
		);
	});
}

function cloneGitRepo(source: string, as: string) {
	const targetPath = path.join(DOTFILES_ROOT, as);

	return Effect.tryPromise({
		try: () =>
			EXEC(
				`git clone --depth 1 https://github.com/${source}.git ${targetPath}`,
			),
		catch: (cause) =>
			new ExecCommandError({
				command: `git clone --depth 1 https://github.com/${source}.git ${targetPath}`,
				cause,
			}),
	});
}
