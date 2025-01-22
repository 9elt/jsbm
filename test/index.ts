import { spawn } from "child_process";

const proc = spawn("bun", [
    "src/index.ts",
    "test/benchmark.ts",
]);

let stdout = "";

proc.stdout.addListener("data", (data) => (stdout += String(data)));
proc.stderr.addListener("data", (data) => (stdout += String(data)));

await new Promise((resolve) =>
    proc.addListener("exit", (code) => {
        if (code) {
            console.error(stdout);
            process.exit(code);
        }
        resolve(true);
    })
);

const lines = stdout.split("\n");

let failed = 0;
let passed = 0;

[
    />test\/benchmark.ts bun@\d+.\d+.\d+ iter:1 samples:1000/,
    /statement-100μs \| 10\d.\d\dμs ±\d+.\d\dμs :\d+%/,
    /block-1.0ms \| 1.0\dms ±\d+.\d\dμs :\d+%/,
    /nest-500μs \| 500.\d\dμs ±\d+.\d\dμs :\d+%/,
    /declaration-1.0ms \| 1.0\dms ±\d+.\d\dμs :\d+%/,
    /nest-1.0ms \| 1.0\dms ±\d+.\d\dμs :\d+%/,
].forEach((reg, i) => {
    const line = lines[i];

    if (!reg.test(line)) {
        console.error("> test failed @", line);
        failed++;
    } else {
        passed++;
    }
});

if (failed) {
    console.error(">", passed, "tests passed");
    console.error(">", failed, "tests failed");
    process.exit(1);
} else {
    console.log(">", passed, "tests passed");
    console.log(">", failed, "tests failed");
}
