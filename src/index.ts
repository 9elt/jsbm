#!/usr/bin/env node

import { spawn } from "child_process";
import fs from "fs";
import {
    HELP,
    RUNTIMES,
    VERSION,
    type Runtime,
} from "./consts";
import { createBenchmarkCode } from "./create.code";
import { printCode } from "./print.code";
import { addJSBMExtension, getVersion } from "./util";

export type Args = {
    // --version -V
    version?: boolean;
    // --help
    help?: boolean;
    // --keep
    keepFile?: boolean;
    // --code
    printCode?: boolean;
    // --md
    markdown?: boolean;
    // --sample
    sample: number;
    // --iter
    iter: number;
};

const args = process.argv.slice(2);

const runtimes: Runtime[] = [];
const files: string[] = [];

const options: Args = {
    sample: 1000,
    iter: 1,
};

let option: keyof typeof options | null = null;

for (const arg of args) {
    if (RUNTIMES.includes(arg as Runtime)) {
        runtimes.push(arg as Runtime);
    } else if (fs.existsSync(arg)) {
        files.push(arg);
    } else if (arg === "--version" || arg === "-V") {
        options.version = true;
    } else if (arg === "--help" || arg === "-h") {
        options.help = true;
    } else if (arg === "--keep") {
        options.keepFile = true;
    } else if (arg === "--md") {
        options.markdown = true;
    } else if (arg === "--code") {
        options.printCode = true;
    } else if (arg === "--sample") {
        option = "sample";
    } else if (arg === "--iter") {
        option = "iter";
    } else if (option) {
        // @ts-ignore
        options[option] = Number(arg);
        option = null;
    }
}

if (options.version) {
    console.log(VERSION);
    process.exit(0);
}

if (options.help) {
    console.log(HELP);
    process.exit(0);
}

for (const runtime of runtimes) {
    try {
        await getVersion(runtime);
    } catch (e) {
        console.error(runtime, "not found");
        process.exit(1);
    }
}

if (runtimes.length === 0) {
    for (const runtime of RUNTIMES) {
        try {
            await getVersion(runtime);
            runtimes.push(runtime);
            break;
        } catch {}
    }
}

if (runtimes.length === 0) {
    console.error("Please provide a valid runtime");
    process.exit(1);
}

if (files.length === 0) {
    console.error("Please provide a file");
    process.exit(1);
}

if (options.printCode) {
    for (const file of files) {
        printCode(file, options);
    }
}

for (const file of files) {
    const isTS = file.endsWith("ts") || undefined;

    const outputFile = addJSBMExtension(file);

    fs.writeFileSync(
        outputFile,
        createBenchmarkCode(file, { ...options, ts: isTS })
    );

    function deleteFile() {
        if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
        }
    }

    if (!options.keepFile) {
        process.on("SIGINT", deleteFile);
        process.on("SIGTERM", deleteFile);
    }

    for (const runtime of runtimes) {
        const version = await getVersion(runtime);

        if (options.markdown) {
            console.log(
                "###",
                "*" + file + "*,",
                runtime + "@" + version
            );
            console.log(
                "iter:" + options.iter,
                "samples:" + options.sample
            );
        } else {
            console.log(
                ">" + file,
                runtime + "@" + version,
                "iter:" + options.iter,
                "samples:" + options.sample
            );
        }

        const isTSNode = isTS && runtime === "node";

        const proc = spawn(
            runtime,
            [
                isTSNode && "--no-warnings=ExperimentalWarning",
                isTSNode && "--experimental-strip-types",
                outputFile,
            ].filter(Boolean)
        );

        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);

        await new Promise((resolve) =>
            proc.addListener("exit", resolve)
        );
    }

    if (!options.keepFile) {
        deleteFile();
    }
}
