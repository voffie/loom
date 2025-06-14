export function coloredText(
	text: string,
	color:
		| "black"
		| "red"
		| "green"
		| "yellow"
		| "blue"
		| "magenta"
		| "cyan"
		| "white",
) {
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
	return `${colorCodes[color]}${text}${"\x1b[0m"}`;
}
