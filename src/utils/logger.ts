import { Logger, LogLevel } from "effect";

export function formatText(
	text: string,
	options?: {
		color?:
			| "black"
			| "red"
			| "green"
			| "yellow"
			| "blue"
			| "magenta"
			| "cyan"
			| "white";
		bold?: boolean;
	},
) {
	if (!options) return text;

	const colorCodes = {
		black: "\x1b[30m",
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		magenta: "\x1b[35m",
		cyan: "\x1b[36m",
		white: "\x1b[37m",
	};
	const boldCode = "\x1b[1m";
	const resetCode = "\x1b[0m";

	let prefix = "";

	if (options.color && colorCodes[options.color]) {
		prefix += colorCodes[options.color];
	}

	if (options.bold) {
		prefix += boldCode;
	}

	return `${prefix}${text}${resetCode}`;
}

const getStyleForLevel = (logLevel: LogLevel.LogLevel) => {
	switch (logLevel.label) {
		case "INFO":
		case "DEBUG":
			return (text: string) => formatText(text, { color: "cyan" });
		case "WARN":
			return (text: string) =>
				formatText(text, { color: "yellow", bold: true });
		case "ERROR":
		case "FATAL":
			return (text: string) => formatText(text, { color: "red", bold: true });
		default:
			return (text: string) => text;
	}
};

export const logger = Logger.make(({ logLevel, message }) => {
	const stringifiedMessage = String(message);
	const style = getStyleForLevel(logLevel);
	console.log(style(stringifiedMessage));
});
