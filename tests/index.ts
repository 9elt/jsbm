import { spawn } from "child_process";

let exit = 0;

for (const runtime of ["bun", "deno", "node"]) {
    const proc = spawn("bun", [
        "src/index.ts",
        runtime,
        "tests/benchmark.ts",
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

    [
        />tests\/benchmark.ts (bun|deno|node)@\d+.\d+.\d+ iter:1 samples:1000*/,
        /statement-100μs \| 10\d.\d\dμs ±\d+.\d\dμs :\d+%/,
        /block-1.0ms \| 1.0\dms ±\d+.\d\dμs :\d+%/,
        /nest-500μs \| 50\d.\d\dμs ±\d+.\d\dμs :\d+%/,
        /declaration-1.0ms \| 1.0\dms ±\d+.\d\dμs :\d+%/,
        /nest-1.0ms \| 1.0\dms ±\d+.\d\dμs :\d+%/,
    ].forEach((reg, i) => {
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
