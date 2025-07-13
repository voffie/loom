export type LoomConfigEntry = {
	source?: string;
	target: string;
};

export type LoomConfig = {
	[name: string]: LoomConfigEntry;
};
