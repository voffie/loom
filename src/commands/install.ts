import path from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { EXEC } from "../utils/exec";
import { ExecCommandError } from "../errors";
import { isLocalPath, DOTFILES_ROOT, addLocalEntry } from "../utils/fs";
import { writeEntry } from "../utils/config";
import { formatText, LogStyles } from "../utils/log";
import { taskUI } from "../utils/ui";

const source = Args.text({ name: "source" });
const as = Options.text("as");
export const install = Command.make(
	"install",
	{ source, as },
	({ source, as }) => execute(source, as),
);

function execute(source: string, as: string) {
	return Effect.gen(function* () {
		yield* Console.log(
			formatText(`Installing '${source}' as: '${as}'`, { bold: true }),
		);
		const isLocal = yield* isLocalPath(source);

		yield* writeEntry(source, as, isLocal);

		const fetchId = taskUI.start(`Fetching: '${source}'`);
		if (isLocal) {
			const localId = taskUI.start("Move local instance", fetchId);
			yield* addLocalEntry(source, as);
			taskUI.complete(localId);
		} else {
			const remoteId = taskUI.start("Clone remote instance", fetchId);
			yield* cloneGitRepo(source, as);
			taskUI.complete(remoteId);
		}

		taskUI.complete(fetchId);
		taskUI.logFinalMessage(
			LogStyles.success(`Successfully installed '${source}' as '${as}'`),
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
