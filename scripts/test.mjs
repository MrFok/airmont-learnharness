import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const temporaryRoot = path.resolve(tmpdir());
const directory = mkdtempSync(path.join(temporaryRoot, "learnharness-tests-"));
const authFile = path.join(directory, "auth.json");
writeFileSync(authFile, "{}", { mode: 0o600 });
const requested = process.argv.slice(2);
const child = spawn(process.execPath, [
	"--import", "tsx", "--test",
	...(requested.length ? requested : ["tests/*.test.ts", "tests/*.test.tsx"]),
], {
	stdio: "inherit",
	env: {
		...process.env,
		NODE_ENV: "test",
		LH_DATA_DIR: path.join(directory, "data"),
		LH_AUTH_FILE: authFile,
	},
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
	console.error(error.message);
	process.exitCode = 1;
});
child.on("close", (code) => {
	process.exitCode = code ?? 1;
	if (process.exitCode !== 0) {
		console.error(`Test data retained at ${directory}`);
		return;
	}
	const relative = path.relative(temporaryRoot, directory);
	if (relative.startsWith("learnharness-tests-") && !relative.includes(path.sep) && !path.isAbsolute(relative)) {
		rmSync(directory, { recursive: true, force: true });
	}
});
