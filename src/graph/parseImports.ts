import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as fs from "fs";
import * as path from "path";

function tryResolveFile(basePath: string): string | null {
    const candidates = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.jsx`,
        `${basePath}.mjs`,
        `${basePath}.cjs`,
        path.join(basePath, "index.ts"),
        path.join(basePath, "index.tsx"),
        path.join(basePath, "index.js"),
        path.join(basePath, "index.jsx"),
        path.join(basePath, "index.mjs"),
        path.join(basePath, "index.cjs"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return path.normalize(candidate);
        }
    }

    return null;
}

export function extractRelativeImports(filePath: string): string[] {
    const code = fs.readFileSync(filePath, "utf8");

    const ast = parse(code, {
        sourceType: "unambiguous",
        plugins: [
            "typescript",
            "jsx",
            "dynamicImport",
        ],
        errorRecovery: true,
    });

    const imports = new Set<string>();

    function addImport(rawSource: unknown) {
        if (typeof rawSource !== "string") {
            return;
        }

        if (!rawSource.startsWith(".")) {
            return;
        }

        const resolved = tryResolveFile(
            path.resolve(path.dirname(filePath), rawSource)
        );

        if (resolved) {
            imports.add(resolved);
        }
    }

    traverse(ast, {
        ImportDeclaration(path) {
            addImport(path.node.source.value);
        },
        ExportNamedDeclaration(path) {
            addImport(path.node.source?.value);
        },
        ExportAllDeclaration(path) {
            addImport(path.node.source?.value);
        },
        CallExpression(path) {
            const callee = path.node.callee;

            if (
                callee.type === "Identifier" &&
                callee.name === "require" &&
                path.node.arguments.length > 0
            ) {
                const arg = path.node.arguments[0];
                if (arg.type === "StringLiteral") {
                    addImport(arg.value);
                }
            }
        },
        Import(path) {
            const parent = path.parent;
            if (
                parent &&
                parent.type === "CallExpression" &&
                parent.arguments.length > 0
            ) {
                const arg = parent.arguments[0];
                if (arg.type === "StringLiteral") {
                    addImport(arg.value);
                }
            }
        },
    });

    return [...imports];
}