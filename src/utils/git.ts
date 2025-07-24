import { Effect } from "effect";
import { ValidationError } from "../errors";
import { EXEC } from "./exec";

export const ensureGitAvailable = Effect.tryPromise({
	try: () => EXEC("git --version"),
	catch: (err) =>
		new ValidationError({
			raw_input: "git",
			message: `Git is not available or not in PATH. Please install Git to use Git-based patterns. Error: ${err}`,
		}),
}).pipe(Effect.asVoid);
