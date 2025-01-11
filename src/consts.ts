import ts from "typescript";
// @ts-ignore
import { PACKAGE_VERSION } from "./macro" assert { type: "macro" };

export const VERSION = PACKAGE_VERSION();

export type Runtime = "bun" | "deno" | "node" | "ts-node";

export const RUNTIMES: Runtime[] = ["bun", "deno", "node"];

export const HELP = `jsbm [runtimes] [files] [options]
runtimes:
    ${RUNTIMES.join(", ")}
options:
    --version, -V    print version
    --help           print help
    --keep           keep generated file(s)
    --code           print measured code
    --md             print results as markdown
    --sample         number of samples
    --iter           number of iterations
`;

export const PRINTER = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
});

export const TF = ts.factory;
