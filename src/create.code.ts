import ts from "typescript";
import type { Args } from ".";
import { PRINTER, TF } from "./consts";
import {
    getJSBMTagId,
    getSourceFile,
    nodeContainsJSBM,
    parseJSBMTagId,
    TagItem,
} from "./util";

export function createBenchmarkCode(
    path: string,
    options: Args & {
        ts: true | undefined;
    }
): string {
    const file = getSourceFile(path);

    const trasnformed = ts.transform(file, [
        (context: ts.TransformationContext) =>
            (node: ts.Node) =>
                ts.visitNode(
                    node,
                    createVisit(file, context, options)
                ),
    ]);

    const utility = createUtil(options);

    function printNode(node: ts.Node) {
        return PRINTER.printNode(
            ts.EmitHint.Unspecified,
            node,
            file
        );
    }

    return (
        `\
/*
 * auto-generated using jsbm (https://github.com/9elt/jsbm)
 * samples ${options.sample}
 * iter ${options.iter}
 */
` +
        utility.map(printNode).join("\n") +
        "\n" +
        printNode(trasnformed.transformed[0])
    );
}

function createVisit(
    file: ts.SourceFile,
    context: ts.TransformationContext,
    options: Args & {
        ts: true | undefined;
    }
) {
    return function visit(node: ts.Node, count = 0) {
        const isSourceFile = ts.isSourceFile(node);
        const isBlock = ts.isBlock(node);

        if (!isSourceFile && !isBlock) {
            return ts.visitEachChild(node, visit, context);
        }

        const update: ts.Node[] = [];

        let isModified = false;

        node.forEachChild((child) => {
            const hasNestedJSBM = nodeContainsJSBM(child, file);

            if (!hasNestedJSBM) {
                update.push(child);
            }

            try {
                child.getChildCount(file);
            } catch {
                if (hasNestedJSBM) {
                    update.push(ts.visitNode(child, visit));
                    isModified = true;
                }
                return;
            }

            const id = getJSBMTagId(child.getChildAt(0, file));

            if (!id) {
                if (hasNestedJSBM) {
                    update.push(ts.visitNode(child, visit));
                    isModified = true;
                }
                return;
            }

            const parts = parseJSBMTagId(id);

            const displayId =
                parts.find((part) => part.type === TagItem.Data)
                    ?.data ||
                parts.find(
                    (part) => part.type === TagItem.FunctionExpr
                )?.name ||
                "";

            const callExpr =
                ts.isFunctionDeclaration(child) &&
                child.name &&
                TF.createExpressionStatement(
                    createFunctionCallExpr(child, parts)
                );

            const _node = callExpr
                ? TF.createBlock([callExpr])
                : TF.createBlock([child as ts.Statement]);

            // NOTE: push function declaration
            if (ts.isFunctionDeclaration(child)) {
                update.push(child);
            }

            update.push(
                createBenchmark(_node, {
                    ...options,
                    id: displayId,
                })
            );

            if (hasNestedJSBM) {
                update.push(
                    TF.createBlock(
                        [
                            ts.visitNode(
                                child,
                                visit
                            ) as ts.Statement,
                            callExpr as ts.Statement,
                        ].filter(Boolean)
                    )
                );
            }

            isModified = true;
        });

        if (!isModified) {
            return node;
        }

        if (isSourceFile) {
            return TF.updateSourceFile(
                node,
                update as ts.Statement[]
            );
        }

        if (isBlock) {
            return TF.updateBlock(
                node,
                update as ts.Statement[]
            );
        }
    };
}

function createBenchmark(
    code: ts.Block,
    options: Args & {
        id: string;
        ts: true | undefined;
    }
) {
    return TF.createTryStatement(
        TF.createBlock(
            options.sample > 1
                ? [
                      createVarStatement(
                          "__samples",
                          TF.createNewExpression(
                              TF.createIdentifier("Array"),
                              options.ts &&
                                  TF.createNodeArray([
                                      TF.createKeywordTypeNode(
                                          ts.SyntaxKind
                                              .NumberKeyword
                                      ),
                                  ]),
                              TF.createNodeArray([
                                  TF.createNumericLiteral(
                                      options.sample
                                  ),
                              ])
                          ),
                          ts.NodeFlags.Const
                      ),
                      TF.createForStatement(
                          createVar(
                              "__sample_i",
                              TF.createNumericLiteral(0),
                              ts.NodeFlags.Let
                          ),
                          TF.createLessThan(
                              TF.createIdentifier("__sample_i"),
                              TF.createNumericLiteral(
                                  options.sample
                              )
                          ),
                          TF.createPostfixIncrement(
                              TF.createIdentifier("__sample_i")
                          ),
                          TF.createBlock([
                              createVarStatement(
                                  "__start",
                                  TF.createCallExpression(
                                      TF.createPropertyAccessExpression(
                                          TF.createIdentifier(
                                              "performance"
                                          ),
                                          TF.createIdentifier(
                                              "now"
                                          )
                                      ),
                                      undefined,
                                      []
                                  ),
                                  ts.NodeFlags.Const
                              ),
                              createIterCode(code, options),
                              TF.createExpressionStatement(
                                  TF.createAssignment(
                                      TF.createElementAccessExpression(
                                          TF.createIdentifier(
                                              "__samples"
                                          ),
                                          TF.createIdentifier(
                                              "__sample_i"
                                          )
                                      ),
                                      TF.createSubtract(
                                          TF.createCallExpression(
                                              TF.createPropertyAccessExpression(
                                                  TF.createIdentifier(
                                                      "performance"
                                                  ),
                                                  TF.createIdentifier(
                                                      "now"
                                                  )
                                              ),
                                              undefined,
                                              []
                                          ),
                                          TF.createIdentifier(
                                              "__start"
                                          )
                                      )
                                  )
                              ),
                          ])
                      ),
                      TF.createExpressionStatement(
                          TF.createCallExpression(
                              TF.createIdentifier(
                                  "__jsbm_print"
                              ),
                              undefined,
                              [
                                  TF.createStringLiteral(
                                      options.id
                                  ),
                                  TF.createCallExpression(
                                      TF.createIdentifier(
                                          "__jsbm_result"
                                      ),
                                      undefined,
                                      [
                                          TF.createIdentifier(
                                              "__samples"
                                          ),
                                      ]
                                  ),
                              ]
                          )
                      ),
                  ]
                : [
                      createVarStatement(
                          "__start",
                          TF.createCallExpression(
                              TF.createPropertyAccessExpression(
                                  TF.createIdentifier(
                                      "performance"
                                  ),
                                  TF.createIdentifier("now")
                              ),
                              undefined,
                              []
                          ),
                          ts.NodeFlags.Const
                      ),
                      createIterCode(code, options),
                      createVarStatement(
                          "__end",
                          TF.createSubtract(
                              TF.createCallExpression(
                                  TF.createPropertyAccessExpression(
                                      TF.createIdentifier(
                                          "performance"
                                      ),
                                      TF.createIdentifier("now")
                                  ),
                                  undefined,
                                  []
                              ),
                              TF.createIdentifier("__start")
                          ),
                          ts.NodeFlags.Const
                      ),
                      TF.createExpressionStatement(
                          TF.createCallExpression(
                              TF.createIdentifier(
                                  "__jsbm_print"
                              ),
                              undefined,
                              [
                                  TF.createStringLiteral(
                                      options.id
                                  ),

                                  TF.createCallExpression(
                                      TF.createIdentifier(
                                          "__jsbm_time_unit"
                                      ),
                                      undefined,
                                      [
                                          TF.createIdentifier(
                                              "__end"
                                          ),
                                      ]
                                  ),
                              ]
                          )
                      ),
                  ]
        ),
        TF.createCatchClause(
            TF.createVariableDeclaration("e"),
            TF.createBlock([
                TF.createExpressionStatement(
                    TF.createCallExpression(
                        TF.createIdentifier("__jsbm_print"),
                        undefined,
                        [
                            TF.createStringLiteral(options.id),
                            TF.createIdentifier("e"),
                        ]
                    )
                ),
            ])
        ),
        undefined
    );
}

function createIterCode(
    code: ts.Block,
    options: Args & { ts: true | undefined }
) {
    return options.iter > 1
        ? TF.createForStatement(
              createVar(
                  "__iter",
                  TF.createNumericLiteral(0),
                  ts.NodeFlags.Let
              ),
              TF.createLessThan(
                  TF.createIdentifier("__iter"),
                  TF.createNumericLiteral(options.iter)
              ),
              TF.createPostfixIncrement(
                  TF.createIdentifier("__iter")
              ),
              code
          )
        : code;
}

function createUtil(
    options: Args & {
        ts: true | undefined;
    }
) {
    return [
        TF.createFunctionDeclaration(
            undefined,
            undefined,
            TF.createIdentifier("__jsbm_time_unit"),
            undefined,
            [
                TF.createParameterDeclaration(
                    undefined,
                    undefined,
                    TF.createIdentifier("ms"),
                    undefined,
                    options.ts &&
                        TF.createKeywordTypeNode(
                            ts.SyntaxKind.NumberKeyword
                        )
                ),
            ],
            undefined,
            TF.createBlock([
                TF.createReturnStatement(
                    TF.createConditionalExpression(
                        TF.createGreaterThan(
                            TF.createIdentifier("ms"),
                            TF.createNumericLiteral(1_000)
                        ),
                        undefined,
                        TF.createAdd(
                            TF.createCallExpression(
                                TF.createPropertyAccessExpression(
                                    TF.createDivide(
                                        TF.createIdentifier(
                                            "ms"
                                        ),
                                        TF.createNumericLiteral(
                                            1_000
                                        )
                                    ),
                                    TF.createIdentifier(
                                        "toFixed"
                                    )
                                ),
                                undefined,
                                [TF.createNumericLiteral(2)]
                            ),
                            TF.createStringLiteral("s")
                        ),
                        undefined,
                        TF.createConditionalExpression(
                            TF.createGreaterThan(
                                TF.createIdentifier("ms"),
                                TF.createNumericLiteral(1)
                            ),
                            undefined,
                            TF.createAdd(
                                TF.createCallExpression(
                                    TF.createPropertyAccessExpression(
                                        TF.createIdentifier(
                                            "ms"
                                        ),
                                        TF.createIdentifier(
                                            "toFixed"
                                        )
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
                                        TF.createMultiply(
                                            TF.createIdentifier(
                                                "ms"
                                            ),
                                            TF.createNumericLiteral(
                                                1_000
                                            )
                                        ),
                                        TF.createIdentifier(
                                            "toFixed"
                                        )
                                    ),
                                    undefined,
                                    [TF.createNumericLiteral(2)]
                                ),
                                TF.createStringLiteral("μs")
                            )
                        )
                    )
                ),
            ])
        ),
        options.sample > 1 &&
            TF.createFunctionDeclaration(
                undefined,
                undefined,
                TF.createIdentifier("__jsbm_result"),
                undefined,
                [
                    TF.createParameterDeclaration(
                        undefined,
                        undefined,
                        TF.createIdentifier("samples"),
                        undefined,
                        options.ts &&
                            TF.createArrayTypeNode(
                                TF.createKeywordTypeNode(
                                    ts.SyntaxKind.NumberKeyword
                                )
                            )
                    ),
                ],
                undefined,
                TF.createBlock([
                    TF.createExpressionStatement(
                        TF.createCallExpression(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("samples"),
                                TF.createIdentifier("sort")
                            ),
                            undefined,
                            [
                                TF.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [
                                        TF.createParameterDeclaration(
                                            undefined,
                                            undefined,
                                            TF.createIdentifier(
                                                "a"
                                            ),
                                            undefined,
                                            options.ts &&
                                                TF.createKeywordTypeNode(
                                                    ts
                                                        .SyntaxKind
                                                        .NumberKeyword
                                                )
                                        ),
                                        TF.createParameterDeclaration(
                                            undefined,
                                            undefined,
                                            TF.createIdentifier(
                                                "b"
                                            ),
                                            undefined,
                                            options.ts &&
                                                TF.createKeywordTypeNode(
                                                    ts
                                                        .SyntaxKind
                                                        .NumberKeyword
                                                )
                                        ),
                                    ],
                                    undefined,
                                    undefined,
                                    TF.createSubtract(
                                        TF.createIdentifier(
                                            "a"
                                        ),
                                        TF.createIdentifier("b")
                                    )
                                ),
                            ]
                        )
                    ),
                    createVarStatement(
                        "q",
                        TF.createDivide(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("samples"),
                                TF.createIdentifier("length")
                            ),
                            TF.createNumericLiteral(4)
                        ),
                        ts.NodeFlags.Const
                    ),
                    createVarStatement(
                        "sampleQ3",
                        TF.createElementAccessExpression(
                            TF.createIdentifier("samples"),
                            TF.createCallExpression(
                                TF.createPropertyAccessExpression(
                                    TF.createIdentifier("Math"),
                                    TF.createIdentifier("ceil")
                                ),
                                undefined,
                                [
                                    TF.createMultiply(
                                        TF.createIdentifier(
                                            "q"
                                        ),
                                        TF.createNumericLiteral(
                                            3
                                        )
                                    ),
                                ]
                            )
                        ),
                        ts.NodeFlags.Const
                    ),
                    createVarStatement(
                        "sampleQ1",
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
                    createVarStatement(
                        "m",
                        TF.createMultiply(
                            TF.createSubtract(
                                TF.createIdentifier("sampleQ3"),
                                TF.createIdentifier("sampleQ1")
                            ),
                            TF.createNumericLiteral(1.5)
                        ),
                        ts.NodeFlags.Const
                    ),
                    createVarStatement(
                        "sampleQ3e",
                        TF.createAdd(
                            TF.createIdentifier("sampleQ3"),
                            TF.createIdentifier("m")
                        ),
                        ts.NodeFlags.Const
                    ),
                    createVarStatement(
                        "sampleQ1s",
                        TF.createSubtract(
                            TF.createIdentifier("sampleQ1"),
                            TF.createIdentifier("m")
                        ),
                        ts.NodeFlags.Const
                    ),
                    createVarStatement(
                        "mean",
                        TF.createNumericLiteral(0),
                        ts.NodeFlags.Let
                    ),
                    createVarStatement(
                        "_samples",
                        TF.createArrayLiteralExpression([]),
                        ts.NodeFlags.Const,
                        options.ts &&
                            TF.createArrayTypeNode(
                                TF.createKeywordTypeNode(
                                    ts.SyntaxKind.NumberKeyword
                                )
                            )
                    ),
                    TF.createForStatement(
                        createVar(
                            "i",
                            TF.createNumericLiteral(0),
                            ts.NodeFlags.Let
                        ),
                        TF.createLessThan(
                            TF.createIdentifier("i"),
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("samples"),
                                TF.createIdentifier("length")
                            )
                        ),
                        TF.createPostfixIncrement(
                            TF.createIdentifier("i")
                        ),
                        TF.createBlock([
                            createVarStatement(
                                "sample",
                                TF.createElementAccessExpression(
                                    TF.createIdentifier(
                                        "samples"
                                    ),
                                    TF.createIdentifier("i")
                                ),
                                ts.NodeFlags.Const
                            ),
                            TF.createIfStatement(
                                TF.createLogicalAnd(
                                    TF.createLessThanEquals(
                                        TF.createIdentifier(
                                            "sample"
                                        ),
                                        TF.createIdentifier(
                                            "sampleQ3e"
                                        )
                                    ),
                                    TF.createGreaterThanEquals(
                                        TF.createIdentifier(
                                            "sample"
                                        ),
                                        TF.createIdentifier(
                                            "sampleQ1s"
                                        )
                                    )
                                ),
                                TF.createBlock([
                                    TF.createExpressionStatement(
                                        TF.createCallExpression(
                                            TF.createPropertyAccessExpression(
                                                TF.createIdentifier(
                                                    "_samples"
                                                ),
                                                TF.createIdentifier(
                                                    "push"
                                                )
                                            ),
                                            undefined,
                                            [
                                                TF.createIdentifier(
                                                    "sample"
                                                ),
                                            ]
                                        )
                                    ),
                                    TF.createExpressionStatement(
                                        TF.createBinaryExpression(
                                            TF.createIdentifier(
                                                "mean"
                                            ),
                                            ts.SyntaxKind
                                                .PlusEqualsToken,
                                            TF.createIdentifier(
                                                "sample"
                                            )
                                        )
                                    ),
                                ])
                            ),
                        ])
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
                    createVarStatement(
                        "std",
                        TF.createNumericLiteral(0),
                        ts.NodeFlags.Let
                    ),
                    TF.createForStatement(
                        createVar(
                            "i",
                            TF.createNumericLiteral(0),
                            ts.NodeFlags.Let
                        ),
                        TF.createLessThan(
                            TF.createIdentifier("i"),
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("_samples"),
                                TF.createIdentifier("length")
                            )
                        ),
                        TF.createPostfixIncrement(
                            TF.createIdentifier("i")
                        ),
                        TF.createBlock([
                            TF.createExpressionStatement(
                                TF.createBinaryExpression(
                                    TF.createIdentifier("std"),
                                    ts.SyntaxKind
                                        .PlusEqualsToken,
                                    TF.createBinaryExpression(
                                        TF.createSubtract(
                                            TF.createElementAccessExpression(
                                                TF.createIdentifier(
                                                    "_samples"
                                                ),
                                                TF.createIdentifier(
                                                    "i"
                                                )
                                            ),
                                            TF.createIdentifier(
                                                "mean"
                                            )
                                        ),
                                        ts.SyntaxKind
                                            .AsteriskAsteriskToken,
                                        TF.createNumericLiteral(
                                            2
                                        )
                                    )
                                )
                            ),
                        ])
                    ),
                    TF.createExpressionStatement(
                        TF.createAssignment(
                            TF.createIdentifier("std"),
                            TF.createCallExpression(
                                TF.createPropertyAccessExpression(
                                    TF.createIdentifier("Math"),
                                    TF.createIdentifier("sqrt")
                                ),
                                undefined,
                                [
                                    TF.createDivide(
                                        TF.createIdentifier(
                                            "std"
                                        ),
                                        TF.createPropertyAccessExpression(
                                            TF.createIdentifier(
                                                "_samples"
                                            ),
                                            TF.createIdentifier(
                                                "length"
                                            )
                                        )
                                    ),
                                ]
                            )
                        )
                    ),
                    createVarStatement(
                        "outliers",
                        TF.createCallExpression(
                            TF.createPropertyAccessExpression(
                                TF.createIdentifier("Math"),
                                TF.createIdentifier("round")
                            ),
                            undefined,
                            [
                                TF.createSubtract(
                                    TF.createNumericLiteral(
                                        100
                                    ),
                                    TF.createDivide(
                                        TF.createMultiply(
                                            TF.createPropertyAccessExpression(
                                                TF.createIdentifier(
                                                    "_samples"
                                                ),
                                                TF.createIdentifier(
                                                    "length"
                                                )
                                            ),
                                            TF.createNumericLiteral(
                                                100
                                            )
                                        ),
                                        TF.createPropertyAccessExpression(
                                            TF.createIdentifier(
                                                "samples"
                                            ),
                                            TF.createIdentifier(
                                                "length"
                                            )
                                        )
                                    )
                                ),
                            ]
                        ),
                        ts.NodeFlags.Const
                    ),
                    TF.createReturnStatement(
                        TF.createAdd(
                            TF.createAdd(
                                TF.createAdd(
                                    TF.createCallExpression(
                                        TF.createIdentifier(
                                            "__jsbm_time_unit"
                                        ),
                                        undefined,
                                        [
                                            TF.createIdentifier(
                                                "mean"
                                            ),
                                        ]
                                    ),
                                    TF.createStringLiteral(" ±")
                                ),
                                TF.createCallExpression(
                                    TF.createIdentifier(
                                        "__jsbm_time_unit"
                                    ),
                                    undefined,
                                    [TF.createIdentifier("std")]
                                )
                            ),
                            TF.createAdd(
                                TF.createAdd(
                                    TF.createStringLiteral(
                                        " :"
                                    ),
                                    TF.createIdentifier(
                                        "outliers"
                                    )
                                ),
                                TF.createStringLiteral("%")
                            )
                        )
                    ),
                ])
            ),
        TF.createFunctionDeclaration(
            undefined,
            undefined,
            TF.createIdentifier("__jsbm_print"),
            undefined,
            [
                TF.createParameterDeclaration(
                    undefined,
                    undefined,
                    TF.createIdentifier("id"),
                    undefined,
                    options.ts &&
                        TF.createKeywordTypeNode(
                            ts.SyntaxKind.StringKeyword
                        )
                ),
                TF.createParameterDeclaration(
                    undefined,
                    undefined,
                    TF.createIdentifier("data"),
                    undefined,
                    options.ts &&
                        TF.createKeywordTypeNode(
                            ts.SyntaxKind.StringKeyword
                        )
                ),
            ],
            undefined,
            TF.createBlock([
                TF.createExpressionStatement(
                    TF.createCallExpression(
                        TF.createPropertyAccessExpression(
                            TF.createIdentifier("console"),
                            TF.createIdentifier("log")
                        ),
                        undefined,
                        options.markdown
                            ? [
                                  TF.createStringLiteral("|"),
                                  TF.createIdentifier("id"),
                                  TF.createStringLiteral("|"),
                                  TF.createIdentifier("data"),
                                  TF.createStringLiteral("|"),
                              ]
                            : [
                                  TF.createIdentifier("id"),
                                  TF.createStringLiteral("|"),
                                  TF.createIdentifier("data"),
                              ]
                    )
                ),
            ])
        ),
        options.markdown &&
            TF.createExpressionStatement(
                TF.createCallExpression(
                    TF.createPropertyAccessExpression(
                        TF.createIdentifier("console"),
                        TF.createIdentifier("log")
                    ),
                    undefined,
                    [TF.createStringLiteral("| id | result |")]
                )
            ),
        options.markdown &&
            TF.createExpressionStatement(
                TF.createCallExpression(
                    TF.createPropertyAccessExpression(
                        TF.createIdentifier("console"),
                        TF.createIdentifier("log")
                    ),
                    undefined,
                    [TF.createStringLiteral("|----|--------|")]
                )
            ),
    ].filter(Boolean);
}

function createFunctionCallExpr(
    node: ts.FunctionDeclaration,
    parts: ReturnType<typeof parseJSBMTagId>
) {
    const functionExpr = parts.find(
        (part) =>
            part.type === TagItem.FunctionExpr &&
            part.name === node.name.text
    );

    return functionExpr
        ? // @ts-ignore
          parseExpression(functionExpr.expr)
        : TF.createCallExpression(
              node.name,
              undefined,
              undefined
          );
}

function parseExpression(value: string) {
    const f = ts.createSourceFile(
        "literal.ts",
        value,
        ts.ScriptTarget.ESNext
    );

    let expression: ts.Expression | undefined;
    f.forEachChild((node) => {
        expression ||= (node as ts.ExpressionStatement)
            .expression;
    });

    return expression!;
}

function createVar(
    name: string,
    initializer?: ts.Expression,
    flags?: ts.NodeFlags,
    type: ts.TypeNode | undefined = undefined
) {
    return TF.createVariableDeclarationList(
        [
            TF.createVariableDeclaration(
                TF.createIdentifier(name),
                undefined,
                type,
                initializer
            ),
        ],
        flags
    );
}

function createVarStatement(
    name: string,
    initializer: ts.Expression,
    flags?: ts.NodeFlags,
    type: ts.TypeNode | undefined = undefined
) {
    return TF.createVariableStatement(
        undefined,
        createVar(name, initializer, flags, type)
    );
}
