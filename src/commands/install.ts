import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import {
	isLocalPath,
	moveToDotfiles,
	cloneGitRepo,
	updateConfig,
	expandPath,
} from "../utils";

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

		if (isLocal) {
			yield* Console.log(`Detected local source: ${expandPath(source)}`);
			yield* moveToDotfiles(source, as);
		} else {
			yield* Console.log(`Cloning git repo: https://github.com/${source}`);
			yield* cloneGitRepo(source, as);
		}

		yield* updateConfig(source, as, isLocal);

		return yield* Console.log(`Installed ${source} as ${as}`);
	});
}
