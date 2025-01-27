import { spawn } from "child_process";
import ts from "typescript";
import { type Runtime } from "./consts";

const versionCache: { [R in Runtime]?: string } = {};

export async function getVersion(
    runtime: Runtime
): Promise<string> {
    if (versionCache[runtime]) {
        return versionCache[runtime];
    }

    const proc = spawn(runtime, ["--version"]);

    const version = String(
        await new Promise((resolve, reject) => {
            proc.stdout.addListener("data", resolve);
            proc.stderr.addListener("data", reject);
        })
    );

    const [semver] = version.match(/\d+\.\d+\.\d+/) || [];

    return (versionCache[runtime] = semver || version);
}

const fileCache: { [key: string]: ts.SourceFile } = {};

export function getSourceFile(path: string) {
    const file =
        fileCache[path] ||
        (fileCache[path] = ts
            .createProgram([path], { allowJs: true })
            .getSourceFile(path));

    if (!file) {
        throw new Error("Failed to get source file" + path);
    }

    return file;
}

export function addJSBMExtension(file: string): string {
    const parts = file.split(".");
    const ext = parts.pop()!;
    parts.push("jsbm", ext);
    return parts.join(".");
}

export function getJSBMTagId(jsdoc?: ts.Node): string[] {
    if (!jsdoc || !ts.isJSDoc(jsdoc)) {
        return [];
    }
    return (
        jsdoc.tags
            ?.filter((tag) => tag.tagName.text === "jsbm")
            .map((tag) =>
                typeof tag.comment === "string"
                    ? tag.comment
                    : tag.comment.join(" ")
            ) || []
    );
}

export function containsJSBM(
    node: ts.Node,
    file: ts.SourceFile
) {
    let contains = false;

    node.forEachChild((node) => {
        try {
            if (
                !contains &&
                (getJSBMTagId(node.getChildAt(0, file))
                    .length ||
                    containsJSBM(node, file))
            ) {
                contains = true;
            }
        } catch {
            return;
        }
    });

    return contains;
}

export function getFunctionName(node: ts.Node) {
    let name: string | undefined;

    let expr:
        | ts.ArrowFunction
        | ts.FunctionDeclaration
        | ts.FunctionExpression
        | undefined;

    if (ts.isFunctionDeclaration(node) && node.name) {
        name = node.name.text;
        expr = node;
    } else if (ts.isVariableStatement(node)) {
        node.forEachChild((c) => {
            if (ts.isVariableDeclarationList(c)) {
                c.forEachChild((c) => {
                    if (ts.isVariableDeclaration(c)) {
                        c.forEachChild((c) => {
                            if (ts.isIdentifier(c)) {
                                name = c.text;
                            } else if (
                                ts.isArrowFunction(c) ||
                                ts.isFunctionExpression(c) ||
                                ts.isFunctionDeclaration(c)
                            ) {
                                expr = c;
                            }
                        });
                    }
                });
            }
        });
    }

    return name && expr ? name : undefined;
}

export enum TagItem {
    FunctionExpr,
    Data,
}

type FunctionExpr = {
    type: TagItem.FunctionExpr;
    expr: string;
    name: string;
};

type _Data = {
    type: TagItem.Data;
    data: string[];
};

type Data = {
    type: TagItem.Data;
    data: string;
};

type _Item = FunctionExpr | _Data;

type Item = FunctionExpr | Data;

const FUNCTION_EXPR = /^(\w+)\s*\(.*\)$/;

export function parseJSBMTagId(
    id: string,
    lookForFunctionExpr: boolean
) {
    type End = ")" | "]" | "}" | ">";

    const S = "([{<";
    const E = ")]}>";

    const parts: string[] = [""];

    let esc = 0;
    let end: End | null = null;

    for (const char of id) {
        if (char === " " && !end) {
            if (parts[parts.length - 1] !== "") {
                parts.push("");
            }
            continue;
        }

        parts[parts.length - 1] += char;

        if (end) {
            if (char === end && --esc === 0) {
                end = null;
            } else if (S.indexOf(char) === E.indexOf(end)) {
                esc++;
            }
        } else {
            const i = S.indexOf(char);

            if (i !== -1) {
                end = E[i] as End;
                esc++;
            }
        }
    }

    const items: Item[] = [];
    let item: _Item = { type: TagItem.Data, data: [] };

    for (const part of parts) {
        if (lookForFunctionExpr && FUNCTION_EXPR.test(part)) {
            const [expr, name] = FUNCTION_EXPR.exec(part);
            if (item.data.length) {
                items.push({
                    ...item,
                    data: item.data.join(" "),
                });
                item = { type: TagItem.Data, data: [] };
            }
            items.push({
                type: TagItem.FunctionExpr,
                expr,
                name,
            });
        } else {
            item.data.push(part);
        }
    }

    if (item.data.length) {
        items.push({
            ...item,
            data: item.data.join(" "),
        });
    }

    return items;
}
