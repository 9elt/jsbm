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

    const version = await new Promise((resolve, reject) => {
        proc.stdout.addListener("data", resolve);
        proc.stderr.addListener("data", reject);
    });

    return (versionCache[runtime] = String(version)
        .trim()
        .replace(/\n/g, "/"));
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

export function getJSBMTagId(
    jsdoc?: ts.Node
): string | undefined {
    if (!jsdoc || !ts.isJSDoc(jsdoc)) {
        return;
    }

    const _id = jsdoc.tags?.find(
        (tag) => tag.tagName.text === "jsbm"
    )?.comment;

    return typeof _id === "string" ? _id : _id?.join(" ");
}
