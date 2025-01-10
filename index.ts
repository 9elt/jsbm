#!/usr/bin/env node

import { spawn } from "child_process";
import fs from "fs";
import ts from "typescript";

const VERSION = "0.2.0";

const HELP = `jsbm [runtimes] [files] [options]
runtimes:
    bun, deno, node, ts-node
options:
    --version, -V    print version
    --help           print help
    --keep           keep generated file(s)
    --code           print measured code
    --md             print results as markdown
    --sample         number of samples
    --iter           number of iterations
`;

type Runtime = "bun" | "deno" | "node" | "ts-node";

const RUNTIMES: Runtime[] = ["bun", "deno", "node", "ts-node"];

const versions: { [R in Runtime]?: string } = {};

const PRINTER = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
});

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
    const isTS = path.endsWith("ts") || undefined;

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
                        ts: isTS,
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

    const utility = createUtil({
        ...options,
        ts: isTS
    });

    function printNode(node: ts.Node) {
        return PRINTER.printNode(
            ts.EmitHint.Unspecified,
            node,
            file
        );
    }

    return `\
/*
 * auto-generated using jsbm (https://github.com/9elt/jsbm)
 * samples ${options.sample}
 * iter ${options.iter}
 */
`
        + utility.map(printNode).join("\n")
        + "\n"
        + printNode(trasnformed.transformed[0]);
}

function benchmark(code: ts.Block, options: Args & {
    id: string;
    ts: true | undefined;
}) {
    // try {
    return TF.createTryStatement(
        TF.createBlock([
            // const __samples = new Array(options.sample);
            createVarStatement(
                "__samples",
                TF.createNewExpression(
                    TF.createIdentifier("Array"),
                    options.ts && TF.createNodeArray([
                        TF.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
                    ]),
                    TF.createNodeArray([TF.createNumericLiteral(options.sample)])
                ),
                ts.NodeFlags.Const,
            ),
            // for (let __sample_i = 0; __sample_i < options.sample; __sample_i++) {
            TF.createForStatement(
                createVar("__sample_i", TF.createNumericLiteral(0), ts.NodeFlags.Let),
                TF.createLessThan(
                    TF.createIdentifier("__sample_i"),
                    TF.createNumericLiteral(options.sample)
                ),
                TF.createPostfixIncrement(TF.createIdentifier("__sample_i")),
                TF.createBlock([
                    // const __start = performance.now();
                    createVarStatement("__start", TF.createCallExpression(
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("performance"),
                            TF.createIdentifier("now")
                        ),
                        undefined,
                        []
                    ), ts.NodeFlags.Const),
                    // for (let __iter = 0; __iter < options.iter; __iter++) {
                    options.iter > 1 ? TF.createForStatement(
                        createVar("__iter", TF.createNumericLiteral(0), ts.NodeFlags.Let),
                        TF.createLessThan(
                            TF.createIdentifier("__iter"),
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
                            TF.createSubtract(
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createIdentifier("performance"),
                                        TF.createIdentifier("now")
                                    ),
                                    undefined,
                                    []
                                ),
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
            TF.createVariableDeclaration("e"),
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

function createVar(name: string, initializer?: ts.Expression, flags?: ts.NodeFlags, type: ts.TypeNode | undefined = undefined) {
    return TF.createVariableDeclarationList([
        TF.createVariableDeclaration(
            TF.createIdentifier(name),
            undefined,
            type,
            initializer
        )
    ], flags);
}

function createVarStatement(name: string, initializer: ts.Expression, flags?: ts.NodeFlags, type: ts.TypeNode | undefined = undefined) {
    return TF.createVariableStatement(
        undefined,
        createVar(name, initializer, flags, type)
    );
}

function createUtil(options: Args & {
    ts: true | undefined;
}) {
    return [
        TF.createFunctionDeclaration(
            undefined,
            undefined,
            TF.createIdentifier("__jsbm_time_unit"),
            undefined,
            [TF.createParameterDeclaration(
                undefined,
                undefined,
                TF.createIdentifier("m"),
                undefined,
                options.ts && TF.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
            )],
            undefined,
            TF.createBlock([
                TF.createReturnStatement(
                    TF.createConditionalExpression(
                        TF.createLessThan(
                            TF.createIdentifier("m"),
                            TF.createNumericLiteral(1_000)
                        ),
                        undefined,
                        TF.createAdd(
                            TF.createCallExpression(
                                TF.createPropertyAccessExpression(
                                    TF.createIdentifier("m"),
                                    TF.createIdentifier("toFixed")
                                ),
                                undefined,
                                [TF.createNumericLiteral(0)]
                            ),
                            TF.createStringLiteral("μs")
                        ),
                        undefined,
                        TF.createConditionalExpression(
                            TF.createLessThan(
                                TF.createIdentifier("m"),
                                TF.createNumericLiteral(1_000_000)
                            ),
                            undefined,
                            TF.createAdd(
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createDivide(
                                            TF.createIdentifier("m"),
                                            TF.createNumericLiteral(1_000)
                                        ),
                                        TF.createIdentifier("toFixed")
                                    ),
                                    undefined,
                                    [TF.createNumericLiteral(2)]
                                ),
                                TF.createStringLiteral("ms")
                            ),
                            undefined,
                            TF.createAdd(
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createDivide(
                                            TF.createIdentifier("m"),
                                            TF.createNumericLiteral(1_000_000)
                                        ),
                                        TF.createIdentifier("toFixed")
                                    ),
                                    undefined,
                                    [TF.createNumericLiteral(2)]
                                ),
                                TF.createStringLiteral("s")
                            )
                        )
                    )
                )
            ])
        ),
        TF.createFunctionDeclaration(
            undefined,
            undefined,
            TF.createIdentifier("__jsbm_result"),
            undefined,
            [TF.createParameterDeclaration(
                undefined,
                undefined,
                TF.createIdentifier("samples"),
                undefined,
                options.ts && TF.createArrayTypeNode(
                    TF.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
                ),
            )],
            undefined,
            TF.createBlock([
                TF.createExpressionStatement(
                    TF.createCallExpression(
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("samples"),
                            TF.createIdentifier("sort")
                        ),
                        undefined,
                        [TF.createArrowFunction(
                            undefined,
                            undefined,
                            [TF.createParameterDeclaration(
                                undefined,
                                undefined,
                                TF.createIdentifier("a"),
                                undefined,
                                options.ts && TF.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
                            ), TF.createParameterDeclaration(
                                undefined,
                                undefined,
                                TF.createIdentifier("b"),
                                undefined,
                                options.ts && TF.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
                            )],
                            undefined,
                            undefined,
                            TF.createSubtract(
                                TF.createIdentifier("a"),
                                TF.createIdentifier("b")
                            )
                        )]
                    )
                ),
                createVarStatement("q",
                    TF.createDivide(
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("samples"),
                            TF.createIdentifier("length")
                        ),
                        TF.createNumericLiteral(4)
                    ),
                    ts.NodeFlags.Const
                ),
                createVarStatement("sampleQ3",
                    TF.createElementAccessExpression(
                        TF.createIdentifier("samples"),
                        TF.createCallExpression(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("Math"),
                                TF.createIdentifier("ceil")
                            ),
                            undefined,
                            [TF.createMultiply(
                                TF.createIdentifier("q"),
                                TF.createNumericLiteral(3)
                            )]
                        )
                    ),
                    ts.NodeFlags.Const
                ),
                createVarStatement("sampleQ1",
                    TF.createElementAccessExpression(
                        TF.createIdentifier("samples"),
                        TF.createCallExpression(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("Math"),
                                TF.createIdentifier("floor")
                            ),
                            undefined,
                            [TF.createIdentifier("q")]
                        )
                    ),
                    ts.NodeFlags.Const
                ),
                createVarStatement("m",
                    TF.createMultiply(
                        TF.createSubtract(
                            TF.createIdentifier("sampleQ3"),
                            TF.createIdentifier("sampleQ1")
                        ),
                        TF.createNumericLiteral(1.5)
                    ),
                    ts.NodeFlags.Const
                ),
                createVarStatement("sampleQ3e",
                    TF.createAdd(
                        TF.createIdentifier("sampleQ3"),
                        TF.createIdentifier("m")
                    ),
                    ts.NodeFlags.Const
                ),
                createVarStatement("sampleQ1s",
                    TF.createSubtract(
                        TF.createIdentifier("sampleQ1"),
                        TF.createIdentifier("m")
                    ),
                    ts.NodeFlags.Const
                ),
                createVarStatement("mean",
                    TF.createNumericLiteral(0),
                    ts.NodeFlags.Let
                ),
                createVarStatement("_samples",
                    TF.createArrayLiteralExpression([]),
                    ts.NodeFlags.Const,
                    options.ts && TF.createArrayTypeNode(
                        TF.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
                    )
                ),
                TF.createForStatement(
                    createVar("i", TF.createNumericLiteral(0), ts.NodeFlags.Let),
                    TF.createLessThan(
                        TF.createIdentifier("i"),
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("samples"),
                            TF.createIdentifier("length")
                        )
                    ),
                    TF.createPostfixIncrement(TF.createIdentifier("i")),
                    TF.createBlock([
                        createVarStatement("sample",
                            TF.createElementAccessExpression(
                                TF.createIdentifier("samples"),
                                TF.createIdentifier("i")
                            ),
                            ts.NodeFlags.Const
                        ),
                        TF.createIfStatement(
                            TF.createLogicalAnd(
                                TF.createLessThanEquals(
                                    TF.createIdentifier("sample"),
                                    TF.createIdentifier("sampleQ3e")
                                ),
                                TF.createGreaterThanEquals(
                                    TF.createIdentifier("sample"),
                                    TF.createIdentifier("sampleQ1s")
                                )
                            ),
                            TF.createBlock([
                                TF.createExpressionStatement(
                                    TF.createCallExpression(
                                        TF.createPropertyAccessExpression(
                                            TF.createIdentifier("_samples"),
                                            TF.createIdentifier("push")
                                        ),
                                        undefined,
                                        [TF.createIdentifier("sample")]
                                    )
                                ),
                                TF.createExpressionStatement(
                                    TF.createBinaryExpression(
                                        TF.createIdentifier("mean"),
                                        ts.SyntaxKind.PlusEqualsToken,
                                        TF.createIdentifier("sample")
                                    )
                                )
                            ])
                        ),
                    ]),
                ),
                TF.createExpressionStatement(
                    TF.createBinaryExpression(
                        TF.createIdentifier("mean"),
                        ts.SyntaxKind.SlashEqualsToken,
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("_samples"),
                            TF.createIdentifier("length")
                        )
                    )
                ),
                createVarStatement("std", TF.createNumericLiteral(0), ts.NodeFlags.Let),
                TF.createForStatement(
                    createVar("i", TF.createNumericLiteral(0), ts.NodeFlags.Let),
                    TF.createLessThan(
                        TF.createIdentifier("i"),
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("_samples"),
                            TF.createIdentifier("length")
                        )
                    ),
                    TF.createPostfixIncrement(TF.createIdentifier("i")),
                    TF.createBlock([
                        TF.createExpressionStatement(
                            TF.createBinaryExpression(
                                TF.createIdentifier("std"),
                                ts.SyntaxKind.PlusEqualsToken,
                                TF.createBinaryExpression(
                                    TF.createSubtract(
                                        TF.createElementAccessExpression(
                                            TF.createIdentifier("_samples"),
                                            TF.createIdentifier("i")
                                        ),
                                        TF.createIdentifier("mean")
                                    ),
                                    ts.SyntaxKind.AsteriskAsteriskToken,
                                    TF.createNumericLiteral(2)
                                )
                            )
                        )
                    ])
                ),
                TF.createExpressionStatement(
                    TF.createAssignment(
                        TF.createIdentifier("mean"),
                        TF.createCallExpression(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("Math"),
                                TF.createIdentifier("round")
                            ),
                            undefined,
                            [TF.createBinaryExpression(
                                TF.createIdentifier("mean"),
                                ts.SyntaxKind.AsteriskToken,
                                TF.createNumericLiteral(1000)
                            )]
                        )
                    )
                ),
                TF.createExpressionStatement(
                    TF.createAssignment(
                        TF.createIdentifier("std"),
                        TF.createCallExpression(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("Math"),
                                TF.createIdentifier("round")
                            ),
                            undefined,
                            [TF.createMultiply(
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createIdentifier("Math"),
                                        TF.createIdentifier("sqrt")
                                    ),
                                    undefined,
                                    [TF.createDivide(
                                        TF.createIdentifier("std"),
                                        TF.createPropertyAccessExpression(
                                            TF.createIdentifier("_samples"),
                                            TF.createIdentifier("length")
                                        )
                                    )]
                                ),
                                TF.createNumericLiteral(1000)
                            )]
                        )
                    ),
                ),
                createVarStatement("outliers",
                    TF.createCallExpression(
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("Math"),
                            TF.createIdentifier("round")
                        ),
                        undefined,
                        [TF.createSubtract(
                            TF.createNumericLiteral(100),
                            TF.createDivide(
                                TF.createMultiply(
                                    TF.createPropertyAccessExpression(
                                        TF.createIdentifier("_samples"),
                                        TF.createIdentifier("length")
                                    ),
                                    TF.createNumericLiteral(100)
                                ),
                                TF.createPropertyAccessExpression(
                                    TF.createIdentifier("samples"),
                                    TF.createIdentifier("length")
                                )
                            )
                        )]
                    ),
                    ts.NodeFlags.Const
                ),
                TF.createReturnStatement(
                    TF.createAdd(
                        TF.createAdd(
                            TF.createAdd(
                                TF.createCallExpression(
                                    TF.createIdentifier("__jsbm_time_unit"),
                                    undefined,
                                    [TF.createIdentifier("mean")]
                                ),
                                TF.createStringLiteral(" ±")
                            ),
                            TF.createCallExpression(
                                TF.createIdentifier("__jsbm_time_unit"),
                                undefined,
                                [TF.createIdentifier("std")]
                            )
                        ),
                        TF.createAdd(
                            TF.createAdd(
                                TF.createStringLiteral(" :"),
                                TF.createIdentifier("outliers"),
                            ),
                            TF.createStringLiteral("%"),
                        )
                    ),
                ),
            ]),
        ),
        TF.createFunctionDeclaration(
            undefined,
            undefined,
            TF.createIdentifier("__jsbm_print"),
            undefined,
            [TF.createParameterDeclaration(
                undefined,
                undefined,
                TF.createIdentifier("id"),
                undefined,
                options.ts && TF.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            ), TF.createParameterDeclaration(
                undefined,
                undefined,
                TF.createIdentifier("data"),
                undefined,
                options.ts && TF.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            )],
            undefined,
            TF.createBlock([
                TF.createExpressionStatement(
                    TF.createCallExpression(
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("console"),
                            TF.createIdentifier("log")
                        ),
                        undefined,
                        options.markdown ? [
                            TF.createStringLiteral("|"),
                            TF.createIdentifier("id"),
                            TF.createStringLiteral("|"),
                            TF.createIdentifier("data"),
                            TF.createStringLiteral("|"),
                        ] : [
                            TF.createIdentifier("id"),
                            TF.createStringLiteral("|"),
                            TF.createIdentifier("data"),
                        ]
                    )
                ),
            ])
        ),
        options.markdown && TF.createExpressionStatement(
            TF.createCallExpression(
                TF.createPropertyAccessExpression(
                    TF.createIdentifier("console"),
                    TF.createIdentifier("log")
                ),
                undefined,
                [
                    TF.createStringLiteral("| id | result |"),
                ]
            )
        ),
        options.markdown && TF.createExpressionStatement(
            TF.createCallExpression(
                TF.createPropertyAccessExpression(
                    TF.createIdentifier("console"),
                    TF.createIdentifier("log")
                ),
                undefined,
                [
                    TF.createStringLiteral("|----|--------|"),
                ]
            )
        ),
    ].filter(Boolean);
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
