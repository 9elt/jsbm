import { spawn } from "child_process";
import { RUNTIMES } from "../src/consts.ts";

const FILES = [
    "tests/time.exact.ts",
    "tests/readme.example.ts",
];

const EXPECT = [
    />tests\/time.exact.ts (bun|deno|node)@\d+.\d+.\d+ iter:1 sample:1000*/,
    /statement-100μs \| 10\d.\d+μs ±\d+.\d+μs :\d+%/,
    /block-200μs \| 20\d.\d+μs ±\d+.\d+μs :\d+%/,
    /nest-100μs \| 10\d.\d+μs ±\d+.\d+μs :\d+%/,
    /declaration-200μs \| 20\d.\d+μs ±\d+.\d+μs :\d+%/,
    /nest-200μs \| 20\d.\d+μs ±\d+.\d+μs :\d+%/,
    /assign-function-100μs \| 10\d.\d+μs ±\d+.\d+μs :\d+%/,
    /arrow-100μs \| 10\d.\d+μs ±\d+.\d+μs :\d+%/,
    /arrow-200μs \| 20\d.\d+μs ±\d+.\d+μs :\d+%/,
    />tests\/readme.example.ts (bun|deno|node)@\d+.\d+.\d+ iter:1 sample:1000*/,
    /map \| \d+.\d+μs ±\d+.\d+μs :\d+%/,
    /push \| \d+.\d+μs ±\d+.\d+μs :\d+%/,
    /prealloc \| \d+.\d+μs ±\d+.\d+μs :\d+%/,
    /prealloc-256 \| \d+.\d+μs ±\d+.\d+μs :\d+%/,
    /prealloc-65536 \| \d+.\d+μs ±\d+.\d+μs :\d+%/,
];

let exit = 0;

for (const runtime of RUNTIMES) {
    const proc = spawn("bun", [
        "src/index.ts",
        runtime,
        ...FILES,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.addListener(
        "data",
        (data) => (stdout += String(data))
    );
    proc.stderr.addListener(
        "data",
        (data) => (stderr += String(data))
    );

    const status: number | null = await new Promise((resolve) =>
        proc.addListener("exit", resolve)
    );

    if (status) {
        console.error(runtime, stderr);
        console.error(runtime, "failed with status", status);
        exit = status;
        continue;
    }

    if (stderr) {
        console.error(runtime, stderr);
    }

    const lines = stdout.split("\n");

    let passed = 0;
    let failed = 0;

    EXPECT.forEach((reg, i) => {
        const line = lines[i];

        if (reg.test(line)) {
            passed++;
        } else {
            console.error("> test failed @", line);
            failed++;
        }
    });

    if (failed) {
        console.error(">", runtime, "failed");
        console.error("   ", passed, "tests passed");
        console.error("   ", failed, "tests failed");
        exit = 1;
    } else {
        console.log(">", runtime, "passed");
        console.log("   ", passed, "tests passed");
        console.log("   ", failed, "tests failed");
    }
}

process.exit(exit);
