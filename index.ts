#!/usr/bin/env node

import { spawn } from "child_process";
import fs from "fs";
import ts from "typescript";

const VERSION = "0.1.0";

const HELP = `Usage: jsbm [runtimes] [file] [options]
runtimes:
    bun, deno, node, ts-node
options:
    --version, -V    print version
    --help           print help
    --keep           keep generated file
    --code           print benchmark code
    --md             print results as markdown
    --sample         number of samples
    --iter           number of iterations
`;

type Runtime = "bun" | "deno" | "node" | "ts-node";

const RUNTIMES: Runtime[] = ["bun", "deno", "node", "ts-node"];

const versions: { [R in Runtime]?: string } = {};

const PRINTER = ts.createPrinter();

const TF = ts.factory;

type Args = {
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

(async function () {
    const args = process.argv.slice(2);

    const runtimes: Runtime[] = [];
    const files: string[] = [];

    const options: Args = {
        sample: 1000,
        iter: 1000,
    };

    let option: keyof typeof options | null = null;

    for (const arg of args) {
        if (RUNTIMES.includes(arg as Runtime)) {
            runtimes.push(arg as Runtime);
        }
        else if (fs.existsSync(arg)) {
            files.push(arg);
        }
        else if (arg === "--version" || arg === "-V") {
            options.version = true;
        }
        else if (arg === "--help") {
            options.help = true;
        }
        else if (arg === "--keep") {
            options.keepFile = true;
        }
        else if (arg === "--md") {
            options.markdown = true;
        }
        else if (arg === "--code") {
            options.printCode = true;
        }
        else if (arg === "--sample") {
            option = "sample";
        }
        else if (arg === "--iter") {
            option = "iter";
        }
        else if (option) {
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
            versions[runtime] = await getVersion(runtime);
        } catch (e) {
            console.error(runtime, "not found");
            process.exit(1);
        }
    }

    if (runtimes.length === 0) {
        for (const runtime of RUNTIMES) {
            try {
                versions[runtime] = await getVersion(runtime);
                runtimes.push(runtime);
                break;
            }
            catch { }
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
            printCode(file, file.endsWith("ts") ? "ts" : "js");
        }
    }

    for (const file of files) {
        const outputFile = addJSBMExtension(file);

        fs.writeFileSync(
            outputFile,
            createBenchmarkCode(file, options)
        );

        for (const runtime of runtimes) {
            if (options.markdown) {
                console.log("###", "*" + file + "*,", runtime + "@" + versions[runtime]);
                console.log("iter:" + options.iter, "samples:" + options.sample);
            } else {
                console.log(">" + file, runtime + "@" + versions[runtime], "iter:" + options.iter, "samples:" + options.sample);
            }

            const proc = spawn(runtime, [outputFile]);

            proc.stdout.pipe(process.stdout);
            proc.stderr.pipe(process.stderr);

            await new Promise((resolve) =>
                proc.addListener("exit", resolve)
            );
        }

        if (!options.keepFile) {
            fs.unlinkSync(outputFile);
        }
    }
})();

const fileCache: { [key: string]: ts.SourceFile; } = {};

function printCode(path: string, ext: "ts" | "js") {
    const file = fileCache[path] || (
        fileCache[path] = ts
            .createProgram([path], { allowJs: true })
            .getSourceFile(path)!
    );

    if (!file) {
        throw new Error("File" + path + "not found");
    }

    function print(node: ts.Node) {
        node.forEachChild((node) => {
            print(node);

            const jsdoc = node.getChildAt(0, file);

            if (!jsdoc || !ts.isJSDoc(jsdoc)) {
                return;
            }

            const _id = jsdoc.tags
                ?.find((tag) => tag.tagName.text === "jsbm")
                ?.comment;

            const id = typeof _id === "string" ? _id : _id?.join(" ");

            if (id) {
                console.log("```" + ext);
                console.log(
                    PRINTER.printNode(ts.EmitHint.Unspecified, node, file)
                );
                console.log("```");
            }
        });
    }
    print(file);
}

function createBenchmarkCode(path: string, options: Args): string {
    const file = fileCache[path] || (
        fileCache[path] = ts
            .createProgram([path], { allowJs: true })
            .getSourceFile(path)!
    );

    if (!file) {
        throw new Error("File" + path + "not found");
    }

    const trasnformed = ts.transform(file, [(context: ts.TransformationContext) => (node: ts.Node) => {
        function visit(node: ts.Node) {
            node = ts.visitEachChild(node, visit, context);

            const update: ts.Node[] = [];

            let isUpdated = false;

            node.forEachChild((node) => {
                update.push(node);

                try { node.getChildCount(file); } catch { return; }

                const jsdoc = node.getChildAt(0, file);

                if (!jsdoc || !ts.isJSDoc(jsdoc)) {
                    return;
                }

                const _id = jsdoc.tags
                    ?.find((tag) => tag.tagName.text === "jsbm")
                    ?.comment;

                const id = typeof _id === "string" ? _id : _id?.join(" ");

                if (!id) {
                    return;
                }

                const displayId = id.replace(/\(.*\)/, "").trim();

                const _node = ts.isFunctionDeclaration(node) && node.name
                    ? TF.createBlock([
                        TF.createExpressionStatement(
                            id.startsWith(node.name.text + "(")
                                ? createLiteral(id)
                                : TF.createCallExpression(
                                    node.name,
                                    undefined,
                                    undefined,
                                ),
                        ),
                    ])
                    : TF.createBlock([node as ts.Statement]);

                update.push(
                    benchmark(_node, {
                        ...options,
                        id: displayId,
                    })
                );

                isUpdated = true;
            });

            if (!isUpdated) {
                return node;
            }

            if (ts.isSourceFile(node)) {
                return TF.updateSourceFile(node, update as ts.Statement[]);
            }

            if (ts.isBlock(node)) {
                return TF.updateBlock(node, update as ts.Statement[]);
            }

            return node;
        }

        return ts.visitNode(node, visit);
    }]);

    return util(options) + PRINTER.printNode(
        ts.EmitHint.Unspecified,
        trasnformed.transformed[0],
        file
    );
}

function benchmark(code: ts.Block, options: Args & {
    id: string;
}) {
    // try {
    return TF.createTryStatement(
        TF.createBlock([
            // const __samples = new Array(options.sample);
            TF.createVariableStatement(undefined,
                TF.createVariableDeclarationList([
                    TF.createVariableDeclaration(
                        TF.createIdentifier("__samples"),
                        undefined,
                        undefined,
                        TF.createNewExpression(
                            TF.createIdentifier("Array"),
                            undefined,
                            TF.createNodeArray([TF.createNumericLiteral(options.sample)])
                        )
                    )
                ], ts.NodeFlags.Const)
            ),
            // for (let __sample_i = 0; __sample_i < options.sample; __sample_i++) {
            TF.createForStatement(
                TF.createVariableDeclarationList([
                    TF.createVariableDeclaration(
                        TF.createIdentifier("__sample_i"),
                        undefined,
                        undefined,
                        TF.createNumericLiteral(0)
                    )
                ], ts.NodeFlags.Let),
                TF.createBinaryExpression(
                    TF.createIdentifier("__sample_i"),
                    ts.SyntaxKind.LessThanToken,
                    TF.createNumericLiteral(options.sample)
                ),
                TF.createPostfixIncrement(TF.createIdentifier("__sample_i")),
                TF.createBlock([
                    // const __start = performance.now();
                    TF.createVariableStatement(undefined,
                        TF.createVariableDeclarationList([
                            TF.createVariableDeclaration(
                                TF.createIdentifier("__start"),
                                undefined,
                                undefined,
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createIdentifier("performance"),
                                        TF.createIdentifier("now")
                                    ),
                                    undefined,
                                    []
                                )
                            ),
                        ], ts.NodeFlags.Const)
                    ),
                    // for (let __iter = 0; __iter < options.iter; __iter++) {
                    options.iter > 1 ? TF.createForStatement(
                        TF.createVariableDeclarationList([
                            TF.createVariableDeclaration(
                                TF.createIdentifier("__iter"),
                                undefined,
                                undefined,
                                TF.createNumericLiteral(0)
                            )
                        ], ts.NodeFlags.Let),
                        TF.createBinaryExpression(
                            TF.createIdentifier("__iter"),
                            ts.SyntaxKind.LessThanToken,
                            TF.createNumericLiteral(options.iter)
                        ),
                        TF.createPostfixIncrement(TF.createIdentifier("__iter")),
                        code,
                    ) : code,
                    // __samples[__sample_i] = performance.now() - __start;
                    TF.createExpressionStatement(
                        TF.createAssignment(
                            TF.createElementAccessExpression(
                                TF.createIdentifier("__samples"),
                                TF.createIdentifier("__sample_i")
                            ),
                            TF.createBinaryExpression(
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createIdentifier("performance"),
                                        TF.createIdentifier("now")
                                    ),
                                    undefined,
                                    []
                                ),
                                ts.SyntaxKind.MinusToken,
                                TF.createIdentifier("__start")
                            )
                        )
                    ),
                ]),
            ),
            // __jsbm_print("ID", __jsbm_result(__samples));
            TF.createExpressionStatement(
                TF.createCallExpression(
                    TF.createIdentifier("__jsbm_print"),
                    undefined,
                    [
                        TF.createStringLiteral(options.id),
                        TF.createCallExpression(
                            TF.createIdentifier("__jsbm_result"),
                            undefined,
                            [TF.createIdentifier("__samples")]
                        )
                    ]
                )
            ),
        ]),
        // } catch (e) {
        TF.createCatchClause(
            TF.createVariableDeclaration(
                "e",
            ),
            TF.createBlock([
                // __jsbm_print(options.id, e);
                TF.createExpressionStatement(
                    TF.createCallExpression(
                        TF.createIdentifier("__jsbm_print"),
                        undefined,
                        [
                            TF.createStringLiteral(options.id),
                            TF.createIdentifier("e")
                        ]
                    )
                )
            ])
        ),
        undefined
    );
}

function createLiteral(value: string) {
    const f = ts.createSourceFile("literal.ts", value, ts.ScriptTarget.ESNext);

    let expression: ts.Expression | undefined;
    f.forEachChild((node) => {
        if (!expression) {
            expression = (node as ts.ExpressionStatement).expression;
        }
    });

    return expression!;
}

function util(options: Args) {
    return `/*
    auto-generated using jsbm (https://github.com/9elt/jsbm)
    samples ${options.sample}
    iter ${options.iter}
*/
function __jsbm_time_unit(m) {
    return m < 1_000
        ? m.toFixed(0) + "μs"
        : m < 1_000_000
            ? (m / 1_000).toFixed(2) + "ms"
            : (m / 1_000_000).toFixed(2) + "s";
}
function __jsbm_result(samples) {
    samples.sort((a, b) => a - b);
    const q = samples.length / 4;
    const sampleQ3 = samples[Math.ceil(q * 3)];
    const sampleQ1 = samples[Math.floor(q)];
    const m = (sampleQ3 - sampleQ1) * 1.5;
    const sampleQ3e = sampleQ3 + m;
    const sampleQ1s = sampleQ1 - m;
    let mean = 0;
    const _samples = [];
    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        if (sample <= sampleQ3e && sample >= sampleQ1s) {
            _samples.push(sample);
            mean += sample;
        }
    }
    mean /= _samples.length;
    let std = 0;
    for (let i = 0; i < _samples.length; i++) {
        std += (_samples[i] - mean) ** 2;
    }
    mean = Math.round(mean * 1000);
    std = Math.round(Math.sqrt(std / _samples.length) * 1000);
    const outliers = Math.round(100 - (_samples.length * 100 / samples.length));
    return __jsbm_time_unit(mean)
        + " ±" + __jsbm_time_unit(std)
        + " :" + outliers + "%";
}
function __jsbm_print(id, data) ${options.markdown ? `{
    console.log("|", id, "|", data, "|");
}
console.log("| id | result |");
console.log("|----|--------|");\
` : `{
    console.log(id, "|", data);
}`}
`;
}

async function getVersion(runtime: Runtime): Promise<string> {
    const proc = spawn(runtime, ["--version"]);

    const version = await new Promise((resolve, reject) => {
        proc.stdout.addListener("data", resolve);
        proc.stderr.addListener("data", reject);
    });

    return String(version).trim();
}

function addJSBMExtension(file: string): string {
    const parts = file.split(".");
    const ext = parts.pop()!;

    parts.push("jsbm", ext);

    return parts.join(".");
}
