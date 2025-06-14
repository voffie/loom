import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { removeDotfileEntry } from "../utils/fs";
import { removeEntry } from "../utils/config";
import { coloredText } from "../utils/color";

const source = Args.text({ name: "source" });
export const remove = Command.make("remove", { source }, ({ source }) =>
	execute(source),
);

function execute(source: string) {
	return Effect.gen(function* () {
		yield* removeEntry(source);
		yield* removeDotfileEntry(source).pipe(
			Effect.catchTag("RemoveEntryError", (err) =>
				Console.log(
					coloredText(
						`Couldn't locate: ${err.path}! Possible already deleted?`,
						"red",
					),
				),
			),
		);

		return yield* Console.log(
			coloredText(`Successfully removed entry for: ${source}`, "green"),
		);
	});
}
