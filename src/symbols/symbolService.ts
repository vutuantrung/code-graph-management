import * as vscode from "vscode";

export interface ReferenceResultItem {
    id: string;
    filePath: string;
    uri: string;
    line: number;
    column: number;
    preview: string;
    kind: "call" | "type" | "import" | "export" | "declaration" | "other";
}

export class SymbolService {
    public async getReferencesAtActiveCursor(): Promise<ReferenceResultItem[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error("No active editor.");
        }

        const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
        if (!wordRange) {
            throw new Error("Cursor is not on a symbol.");
        }

        const uri = editor.document.uri;
        const position = wordRange.start;

        const references =
            await vscode.commands.executeCommand<vscode.Location[]>(
                "vscode.executeReferenceProvider",
                uri,
                position
            );

        if (!references || references.length === 0) {
            return [];
        }

        const items = await Promise.all(
            references.map(async (loc, index) => {
                const doc = await vscode.workspace.openTextDocument(loc.uri);
                const lineText = doc.lineAt(loc.range.start.line).text.trim();

                return {
                    id: `${loc.uri.fsPath}:${loc.range.start.line}:${loc.range.start.character}:${index}`,
                    filePath: loc.uri.fsPath,
                    uri: loc.uri.toString(),
                    line: loc.range.start.line + 1,
                    column: loc.range.start.character + 1,
                    preview: lineText,
                    kind: this.classifyReference(lineText),
                } satisfies ReferenceResultItem;
            })
        );

        return items;
    }

    public async openReference(item: ReferenceResultItem): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(item.filePath);
        const editor = await vscode.window.showTextDocument(doc);

        const pos = new vscode.Position(item.line - 1, item.column - 1);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter
        );
    }

    private classifyReference(line: string): ReferenceResultItem["kind"] {
        const s = line.trim();

        if (/^\s*import\b/.test(s)) return "import";
        if (/^\s*export\b/.test(s)) return "export";
        if (/\bnew\s+[A-Za-z0-9_]+\s*\(/.test(s)) return "call";
        if (/[A-Za-z0-9_]+\s*\(/.test(s)) return "call";
        if (/:\s*[A-Za-z0-9_<>[\]|& ,]+/.test(s) || /\btype\b|\binterface\b/.test(s)) return "type";

        return "other";
    }
}