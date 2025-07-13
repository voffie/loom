import path from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { EXEC } from "../utils/exec";
import { ExecCommandError, ValidationError } from "../errors";
import { pathExists, DOTFILES_ROOT, addLocalEntry } from "../utils/fs";
import { writeEntry } from "../utils/config";
import { formatText } from "../utils/logger";

const source = Args.text({ name: "source" });
const as = Options.text("as");
export const install = Command.make(
	"install",
	{ source, as },
	({ source, as }) => execute(source, as),
);

function execute(source: string, as: string) {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			formatText(
				`
┌─────────────────────────────────────────┐
│              Loom Install               │
└─────────────────────────────────────────┘`,
				{ bold: true, color: "blue" },
			) + "\n",
		);

		yield* Effect.logInfo(
			`• Attempting to weave '${formatText(source, { color: "magenta" })}' as pattern '${formatText(as, { color: "magenta" })}' into your dotfiles.`,
		);

		const isLocal = yield* pathExists(source);

		yield* Effect.logInfo(
			`• Recording pattern: ${formatText(as, { color: "magenta" })}...`,
		);

		yield* writeEntry(source, as, isLocal);

		yield* Effect.logInfo(
			formatText("✓ Pattern recorded.", { color: "green", bold: true }),
		);

		if (isLocal) {
			yield* Effect.logInfo(
				`• Adding local thread for ${formatText(source, { color: "magenta" })}...`,
			);

			yield* addLocalEntry(source, as);

			yield* Effect.logInfo(
				formatText("✓ Local thread added.", { color: "green", bold: true }),
			);
		} else {
			yield* Effect.logInfo(
				`• Spinning new thread from Git: ${formatText(source, { color: "magenta" })}...`,
			);

			yield* cloneGitRepo(source, as);

			yield* Effect.logInfo(
				formatText("✓ Git thread spun.", { color: "green", bold: true }),
			);
		}

		yield* Effect.logInfo(
			formatText(
				`\n✓ Successfully woven '${formatText(source, { color: "magenta" })}' as pattern '${formatText(as, { color: "magenta" })}' into your dotfiles!`,
				{ color: "green", bold: true },
			),
		);
	});
}

function cloneGitRepo(source: string, as: string) {
	// Validates "username/repo" format
	if (!/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(source)) {
		return Effect.fail(
			new ValidationError({
				raw_input: source,
				message: `Invalid Git source format. Expected 'username/repo'. Found '${source}'.`,
			}),
		);
	}
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
	}).pipe(
		Effect.catchAll((err) =>
			Effect.gen(function* () {
				yield* Effect.logError(
					`✗ Failed to spin Git thread for ${formatText(source, { color: "magenta" })}: ${err.message}`,
				);
				yield* Effect.fail(err);
			}),
		),
	);
}
