import * as ChildProcess from "node:child_process";
import { promisify } from "node:util";

export const EXEC = promisify(ChildProcess.exec);
