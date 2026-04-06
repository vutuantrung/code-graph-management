import * as path from "path";
import * as vscode from "vscode";
import { ReferenceKind, ReferenceResultItem } from "../graph/types";

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

    const references = await vscode.commands.executeCommand<vscode.Location[]>(
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
        const preview = doc.lineAt(loc.range.start.line).text.trim();

        return {
          id: `${loc.uri.fsPath}:${loc.range.start.line}:${loc.range.start.character}:${index}`,
          filePath: path.normalize(loc.uri.fsPath),
          uri: loc.uri.toString(),
          line: loc.range.start.line + 1,
          column: loc.range.start.character + 1,
          preview,
          kind: this.classifyReference(preview),
        } satisfies ReferenceResultItem;
      })
    );

    return items;
  }

  public async openReference(item: ReferenceResultItem): Promise<void> {
    const document = await vscode.workspace.openTextDocument(item.filePath);
    const editor = await vscode.window.showTextDocument(document, { preview: false });

    const position = new vscode.Position(item.line - 1, item.column - 1);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  private classifyReference(line: string): ReferenceKind {
    const trimmed = line.trim();

    if (/^\s*import\b/.test(trimmed)) {
      return "import";
    }
    if (/^\s*export\b/.test(trimmed)) {
      return "export";
    }
    if (/\b(class|interface|type)\b/.test(trimmed)) {
      return "declaration";
    }
    if (/\bnew\s+[A-Za-z_$][\w$]*\s*\(/.test(trimmed)) {
      return "call";
    }
    if (/[A-Za-z_$][\w$]*\s*\(/.test(trimmed)) {
      return "call";
    }
    if (/:\s*[A-Za-z0-9_<>[\]|& ,]+/.test(trimmed) || /\bextends\b|\bimplements\b/.test(trimmed)) {
      return "type";
    }

    return "other";
  }
}
