import { Effect } from "effect";
import { formatText } from "./logger";

export function createOperationReporter<T extends Record<string, string>>(
	labels: T & { operationType: string },
) {
	const { operationType, ...counterLabels } = labels;

	const counters = Object.fromEntries(
		Object.keys(counterLabels).map((key) => [key, 0]),
	) as Record<keyof typeof counterLabels, number>;

	return {
		increment: (type: keyof typeof counterLabels) => {
			counters[type]++;
		},

		logSummary: () => {
			const total = Object.values(counters).reduce((a, b) => a + b, 0);

			if (total === 0) {
				return Effect.logInfo(`${operationType}: No operations performed.`);
			}
      
			const parts = Object.entries(counterLabels).map(
				([key, label]) => `${label}: ${counters[key]}`,
			);

			return Effect.logInfo(
				formatText(`${operationType}: ${total}, ${parts.join(", ")}`, {
					color: "blue",
					bold: true,
				}),
			);
		},
	};
}
