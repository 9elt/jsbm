import ts from "typescript";
import { PRINTER } from "./consts";
import { getJSBMTagId, getSourceFile } from "./util";

export function printCode(path: string) {
    const ext = path.endsWith("ts") ? "ts" : "js";
    const file = getSourceFile(path);

    function print(node: ts.Node) {
        node.forEachChild((node) => {
            print(node);

            const id = getJSBMTagId(node.getChildAt(0, file));

            if (id) {
                console.log("```" + ext);
                console.log(
                    PRINTER.printNode(
                        ts.EmitHint.Unspecified,
                        node,
                        file
                    )
                );
                console.log("```");
            }
        });
    }

    print(file);
}
