import { Schema } from "effect";

export type LoomConfigEntry = {
	source?: string;
	target: string;
};

export type LoomConfig = {
	[name: string]: LoomConfigEntry;
};

export const LoomConfigEntrySchema = Schema.Struct({
	source: Schema.optional(Schema.String),
	target: Schema.String,
});

export const LoomConfigSchema = Schema.Record({
	key: Schema.String,
	value: LoomConfigEntrySchema,
});
