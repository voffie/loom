import * as readline from "readline";

type TaskNode = {
	id: number;
	label: string;
	parent: number | null;
};

class TaskTreeUI {
	private nodes = new Map<number, TaskNode>();
	private nextId = 0;
	private interval: NodeJS.Timeout | null = null;
	private lastRenderLineCount = 0;

	constructor(private refreshRateMs = 100) {}

	start(label: string, parent: number | null = null): number {
		if (parent !== null && !this.nodes.has(parent)) {
			throw new Error(`Parent task with ID ${parent} does not exist`);
		}

		if (!this.interval) {
			this.interval = setInterval(() => this.render(), this.refreshRateMs);
		}

		const id = this.nextId++;
		this.nodes.set(id, { id, label, parent });
		return id;
	}

	complete(id: number): void {
		const children = this.getChildren(id);
		children.forEach((child) => this.complete(child.id));
		this.nodes.delete(id);
	}

	stop() {
		if (this.interval) clearInterval(this.interval);
		this.interval = null;
	}

	private render() {
		if (this.lastRenderLineCount > 0) {
			readline.moveCursor(process.stdout, 0, -this.lastRenderLineCount);
			readline.clearScreenDown(process.stdout);
		}

		if (this.nodes.size === 0 && this.interval) {
			this.stop();
			return;
		}

		let linesRendered = 0;

		const rootNodes = this.getChildren(null);
		rootNodes.forEach((node) => {
			process.stdout.write(`${node.label}\n`);
			linesRendered += 1;

			const children = this.getChildren(node.id);
			linesRendered += this.renderSubtree(children, "");
		});

		this.lastRenderLineCount = linesRendered;
	}

	private getChildren(parent: number | null): TaskNode[] {
		return [...this.nodes.values()].filter((n) => n.parent === parent);
	}

	private renderSubtree(nodes: TaskNode[], prefix: string): number {
		let count = 0;

		nodes.forEach((node, idx) => {
			const isLast = idx === nodes.length - 1;
			const branch = isLast ? "└─ " : "├─ ";
			process.stdout.write(prefix + branch + node.label + "\n");
			count += 1;

			const childPrefix = prefix + (isLast ? "   " : "│  ");
			const children = this.getChildren(node.id);
			count += this.renderSubtree(children, childPrefix);
		});

		return count;
	}

	logFinalMessage(message: string) {
		this.render();
		this.stop();

		readline.moveCursor(process.stdout, 0, -this.lastRenderLineCount - 1);
		readline.clearScreenDown(process.stdout);

		process.stdout.write(message + "\n");

		this.lastRenderLineCount = 0;
	}
}

export const taskUI = new TaskTreeUI();
