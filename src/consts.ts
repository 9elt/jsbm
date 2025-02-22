import ts from "typescript";
// @ts-ignore
import { PACKAGE_VERSION } from "./macro" assert { type: "macro" };

export const VERSION = PACKAGE_VERSION();

export type Runtime = "bun" | "deno" | "node";

export const RUNTIMES: Runtime[] = ["bun", "deno", "node"];

export const HELP = `jsbm [runtime...] file... [options]
runtimes:
    ${RUNTIMES.join(", ")}
options:
    --version, -V    print version
    --help, -h       print help
    --keep           keep generated file(s)
    --code           print measured code
    --md             print results as markdown
    --sample         number of samples (default: 1000)
    --iter           measure the code over a number of iterations (default: 1)
`;

export const PRINTER = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
});

export const PRETTY_PRINTER = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
});

export const TF = ts.factory;
