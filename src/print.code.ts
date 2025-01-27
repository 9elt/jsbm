import ts from "typescript";
import { Args } from ".";
import { PRETTY_PRINTER } from "./consts";
import { getJSBMTagId, getSourceFile } from "./util";

export function printCode(path: string, options: Args) {
    const file = getSourceFile(path);

    function print(node: ts.Node) {
        node.forEachChild((node) => {
            const [id] = getJSBMTagId(node.getChildAt(0, file));

            if (id) {
                console.log(header(path, file, node, options));
                console.log(
                    PRETTY_PRINTER.printNode(
                        ts.EmitHint.Unspecified,
                        node,
                        file
                    )
                );
                console.log(footer(options));
            }

            print(node);
        });
    }

    print(file);
}

function header(
    path: string,
    file: ts.SourceFile,
    node: ts.Node,
    options: Args
) {
    if (path.length > 10) {
        path = "..." + path.slice(-10);
    }

    const pos = file.getLineAndCharacterOfPosition(
        node.getStart(file)
    );
    const res = path + "@" + pos.line + ":" + pos.character;

    return options.markdown
        ? "*" +
              res +
              "*\n```" +
              (path.endsWith("ts") ? "ts" : "js")
        : ".".repeat(32 - res.length) + res;
}

function footer(options: Args) {
    return options.markdown ? "```" : ".".repeat(32);
}
