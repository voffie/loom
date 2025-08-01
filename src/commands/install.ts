import path from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Effect, Either } from "effect";
import { EXEC } from "../utils/exec";
import { ExecCommandError, ValidationError } from "../errors";
import { pathExists, DOTFILES_ROOT, addLocalEntry } from "../utils/fs";
import { writeEntry } from "../utils/config";
import { formatText } from "../utils/logger";
import { ensureGitAvailable } from "../utils/git";

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
			`Attempting to weave '${formatText(source, { color: "magenta" })}' as pattern '${formatText(as, { color: "magenta" })}' into your dotfiles.`,
		);

		const isLocal = yield* pathExists(source);

		yield* Effect.logInfo(
			`Recording pattern: ${formatText(as, { color: "magenta" })}...`,
		);

		const writeResult = yield* writeEntry(source, as, isLocal).pipe(
			Effect.either,
		);

		if (
			Either.isLeft(writeResult) &&
			writeResult.left._tag === "UserDeniedOverrideError"
		) {
			yield* Effect.logInfo(
				formatText(`Action cancelled. Entry '${as}' was not updated.`, {
					color: "yellow",
					bold: true,
				}),
			);
			return;
		}

		if (isLocal) {
			const success = yield* handleLocalEntry(source, as);
			if (!success) return;
		} else {
			const success = yield* handleGitEntry(source, as);
			if (!success) return;
		}

		yield* Effect.logInfo(
			formatText(
				`Successfully woven '${formatText(source, { color: "magenta" })}' as pattern '${formatText(as, { color: "magenta" })}' into your dotfiles!`,
				{ color: "green", bold: true },
			),
		);
	});
}

function cloneGitRepo(source: string, as: string) {
	return Effect.gen(function* () {
		// Validates "username/repo" format
		if (!/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(source)) {
			return yield* Effect.fail(
				new ValidationError({
					raw_input: source,
					message: `Invalid Git source format. Expected 'username/repo'. Found '${source}'.`,
				}),
			);
		}

		const targetPath = path.join(DOTFILES_ROOT, as);

		return yield* Effect.tryPromise({
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
	});
}

function handleLocalEntry(source: string, as: string) {
	return Effect.gen(function* () {
		yield* Effect.logInfo(
			`Adding local thread for ${formatText(source, { color: "magenta" })}...`,
		);

		const localResult = yield* addLocalEntry(source, as).pipe(Effect.either);

		if (Either.isLeft(localResult)) {
			yield* Effect.logError(
				`Failed to add local entry for ${formatText(source, { color: "magenta" })}: ${localResult.left.message}`,
			);
			return false;
		}

		return true;
	});
}

function handleGitEntry(source: string, as: string) {
	return Effect.gen(function* () {
		yield* ensureGitAvailable;
		yield* Effect.logInfo(
			`Spinning new thread from Git: ${formatText(source, { color: "magenta" })}...`,
		);

		const gitResult = yield* cloneGitRepo(source, as).pipe(Effect.either);

		if (Either.isLeft(gitResult)) {
			yield* Effect.logError(
				`Failed to spin Git thread for ${formatText(source, { color: "magenta" })}: ${gitResult.left.message}`,
			);
			return false;
		}

		return true;
	});
}
