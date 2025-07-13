import { Schema } from "effect";

export class UserDeniedOverrideError extends Schema.TaggedError<UserDeniedOverrideError>()(
	"UserDeniedOverrideError",
	{},
) {}

export class MakeDirectoryError extends Schema.TaggedError<MakeDirectoryError>()(
	"MakeDirectoryError",
	{
		path: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class ReadFileError extends Schema.TaggedError<ReadFileError>()(
	"ReadFileError",
	{
		path: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class WriteFileError extends Schema.TaggedError<WriteFileError>()(
	"WriteFileError",
	{
		path: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class MoveEntryError extends Schema.TaggedError<MoveEntryError>()(
	"MoveEntryError",
	{
		from: Schema.String,
		to: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class RemoveEntryError extends Schema.TaggedError<RemoveEntryError>()(
	"RemoveEntryError",
	{
		path: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class LocalPathError extends Schema.TaggedError<LocalPathError>()(
	"LocalPathError",
	{
		path: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class ReadDirectoriesError extends Schema.TaggedError<ReadDirectoriesError>()(
	"ReadDirectoriesError",
	{
		path: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class ExecCommandError extends Schema.TaggedError<ExecCommandError>()(
	"ExecCommandError",
	{
		command: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
	"ValidationError",
	{
		raw_input: Schema.String,
		message: Schema.String,
	},
) {}

export class SymlinkError extends Schema.TaggedError<SymlinkError>()(
	"SymlinkError",
	{
		pointer: Schema.String,
		symlink: Schema.String,
		cause: Schema.Unknown,
	},
) {}

export class UnlinkError extends Schema.TaggedError<UnlinkError>()(
	"UnlinkError",
	{
		symlink: Schema.String,
		cause: Schema.Unknown,
	},
) {}
