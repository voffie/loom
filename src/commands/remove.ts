import { Args, Command } from "@effect/cli";
import { Effect } from "effect";
import { removeDotfileEntry } from "../utils/fs";
import { removeEntry } from "../utils/config";
import { formatText, LogStyles } from "../utils/log";
import { taskUI } from "../utils/ui";

const source = Args.text({ name: "source" });
export const remove = Command.make("remove", { source }, ({ source }) =>
	execute(source),
);

function execute(source: string) {
	return Effect.gen(function* () {
		const root = taskUI.start(
			formatText(`Remove entry: '${source}'`, { bold: true }),
		);

		const removeConfigEntryId = taskUI.start("Remove config entry", root);
		yield* removeEntry(source);
		taskUI.complete(removeConfigEntryId);

		const removeDotfileEntryId = taskUI.start("Remove local instance", root);
		yield* removeDotfileEntry(source).pipe(
			Effect.catchTag("RemoveEntryError", (err) =>
				Effect.fail(
					LogStyles.error(
						`Couldn't locate: '${err.path}'! Possible already deleted?`,
					),
				),
			),
		);
		taskUI.complete(removeDotfileEntryId);

		taskUI.complete(root);
		taskUI.logFinalMessage(
			LogStyles.success(`Successfully removed entry for: '${source}'`),
		);
	});
}
