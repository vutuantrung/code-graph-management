import * as vscode from "vscode";
import {
  SerializableRange,
  SymbolCallResult,
  SymbolInspectionResult,
  SymbolKindLabel,
  SymbolRef,
  SymbolReferenceResult,
} from "../graph/types";

export class SymbolExplorerService {
  public async listDocumentSymbols(uri: vscode.Uri): Promise<SymbolRef[]> {
    const result = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[] | vscode.SymbolInformation[] | undefined
    >("vscode.executeDocumentSymbolProvider", uri);

    if (!result || result.length === 0) {
      return [];
    }

    if (this.isDocumentSymbolArray(result)) {
      return this.flattenDocumentSymbols(uri, result);
    }

    return result.map((item) => this.fromSymbolInformation(item));
  }

  public async inspectSymbol(symbol: SymbolRef): Promise<SymbolInspectionResult> {
    const [references, incomingCalls, outgoingCalls] = await Promise.all([
      this.getReferences(symbol),
      this.getIncomingCalls(symbol),
      this.getOutgoingCalls(symbol),
    ]);

    return {
      symbol,
      references,
      incomingCalls,
      outgoingCalls,
    };
  }

  public async openSymbol(symbol: SymbolRef): Promise<void> {
    const uri = vscode.Uri.parse(symbol.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });

    const start = new vscode.Position(
      symbol.selectionRange.startLine,
      symbol.selectionRange.startCharacter
    );
    const end = new vscode.Position(symbol.selectionRange.endLine, symbol.selectionRange.endCharacter);

    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
  }

  public async openLocation(uriString: string, range: SerializableRange): Promise<void> {
    const uri = vscode.Uri.parse(uriString);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });

    const start = new vscode.Position(range.startLine, range.startCharacter);
    const end = new vscode.Position(range.endLine, range.endCharacter);

    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
  }

  private async getReferences(symbol: SymbolRef): Promise<SymbolReferenceResult[]> {
    const uri = vscode.Uri.parse(symbol.uri);
    const position = new vscode.Position(
      symbol.selectionRange.startLine,
      symbol.selectionRange.startCharacter
    );

    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeReferenceProvider",
      uri,
      position
    );

    if (!refs) {
      return [];
    }

    return Promise.all(
      refs.map(async (loc) => {
        const document = await vscode.workspace.openTextDocument(loc.uri);
        const preview = document.lineAt(loc.range.start.line).text.trim();

        return {
          uri: loc.uri.toString(),
          range: this.serializeRange(loc.range),
          preview,
          kind: this.classifyReference(preview),
        };
      })
    );
  }

  private async getIncomingCalls(symbol: SymbolRef): Promise<SymbolCallResult[]> {
    const items = await this.prepareCallHierarchy(symbol);
    if (!items || items.length === 0) {
      return [];
    }

    const incoming = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      "vscode.provideIncomingCalls",
      items[0]
    );

    return (incoming ?? []).map((call) => ({
      symbol: this.fromCallHierarchyItem(call.from),
      fromRanges: call.fromRanges.map((range) => this.serializeRange(range)),
    }));
  }

  private async getOutgoingCalls(symbol: SymbolRef): Promise<SymbolCallResult[]> {
    const items = await this.prepareCallHierarchy(symbol);
    if (!items || items.length === 0) {
      return [];
    }

    const outgoing = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
      "vscode.provideOutgoingCalls",
      items[0]
    );

    return (outgoing ?? []).map((call) => ({
      symbol: this.fromCallHierarchyItem(call.to),
      fromRanges: call.fromRanges.map((range) => this.serializeRange(range)),
    }));
  }

  private async prepareCallHierarchy(symbol: SymbolRef): Promise<vscode.CallHierarchyItem[] | undefined> {
    const uri = vscode.Uri.parse(symbol.uri);
    const position = new vscode.Position(
      symbol.selectionRange.startLine,
      symbol.selectionRange.startCharacter
    );

    return vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      "vscode.prepareCallHierarchy",
      uri,
      position
    );
  }

  private isDocumentSymbolArray(
    symbols: vscode.DocumentSymbol[] | vscode.SymbolInformation[]
  ): symbols is vscode.DocumentSymbol[] {
    return symbols.length === 0 || "selectionRange" in symbols[0];
  }

  private flattenDocumentSymbols(
    uri: vscode.Uri,
    symbols: vscode.DocumentSymbol[],
    containerName?: string
  ): SymbolRef[] {
    const out: SymbolRef[] = [];

    for (const symbol of symbols) {
      const ref: SymbolRef = {
        id: this.makeId(uri, symbol.name, symbol.selectionRange),
        uri: uri.toString(),
        name: symbol.name,
        detail: symbol.detail,
        kind: this.mapSymbolKind(symbol.kind),
        containerName,
        range: this.serializeRange(symbol.range),
        selectionRange: this.serializeRange(symbol.selectionRange),
      };

      out.push(ref);

      if (symbol.children.length > 0) {
        out.push(...this.flattenDocumentSymbols(uri, symbol.children, symbol.name));
      }
    }

    return out;
  }

  private fromSymbolInformation(symbol: vscode.SymbolInformation): SymbolRef {
    return {
      id: this.makeId(symbol.location.uri, symbol.name, symbol.location.range),
      uri: symbol.location.uri.toString(),
      name: symbol.name,
      kind: this.mapSymbolKind(symbol.kind),
      containerName: symbol.containerName,
      range: this.serializeRange(symbol.location.range),
      selectionRange: this.serializeRange(symbol.location.range),
    };
  }

  private fromCallHierarchyItem(item: vscode.CallHierarchyItem): SymbolRef {
    return {
      id: this.makeId(item.uri, item.name, item.selectionRange),
      uri: item.uri.toString(),
      name: item.name,
      detail: item.detail,
      kind: this.mapSymbolKind(item.kind),
      containerName: item.name,
      range: this.serializeRange(item.range),
      selectionRange: this.serializeRange(item.selectionRange),
    };
  }

  private makeId(uri: vscode.Uri, name: string, range: vscode.Range): string {
    return `${uri.toString()}::${name}::${range.start.line}:${range.start.character}`;
  }

  private serializeRange(range: vscode.Range): SerializableRange {
    return {
      startLine: range.start.line,
      startCharacter: range.start.character,
      endLine: range.end.line,
      endCharacter: range.end.character,
    };
  }

  private mapSymbolKind(kind: vscode.SymbolKind): SymbolKindLabel {
    switch (kind) {
      case vscode.SymbolKind.File:
        return "file";
      case vscode.SymbolKind.Module:
        return "module";
      case vscode.SymbolKind.Namespace:
        return "namespace";
      case vscode.SymbolKind.Class:
        return "class";
      case vscode.SymbolKind.Method:
        return "method";
      case vscode.SymbolKind.Function:
        return "function";
      case vscode.SymbolKind.Constructor:
        return "constructor";
      case vscode.SymbolKind.Property:
        return "property";
      case vscode.SymbolKind.Field:
        return "field";
      case vscode.SymbolKind.Variable:
        return "variable";
      case vscode.SymbolKind.Interface:
        return "interface";
      case vscode.SymbolKind.Enum:
        return "enum";
      case vscode.SymbolKind.Constant:
        return "constant";
      case vscode.SymbolKind.TypeParameter:
        return "typeParameter";
      default:
        return "unknown";
    }
  }

  private classifyReference(preview: string): SymbolReferenceResult["kind"] {
    const trimmed = preview.trim();
    if (/^\s*import\b/.test(trimmed)) {
      return "import";
    }
    if (/^\s*export\b/.test(trimmed)) {
      return "export";
    }
    if (/\b(class|interface|type)\b/.test(trimmed)) {
      return "declaration";
    }
    if (/[A-Za-z_$][\w$]*\s*\(/.test(trimmed) || /\bnew\s+[A-Za-z_$][\w$]*\s*\(/.test(trimmed)) {
      return "call";
    }
    if (/:\s*[A-Za-z0-9_<>[\]|& ,]+/.test(trimmed) || /\bextends\b|\bimplements\b/.test(trimmed)) {
      return "type";
    }
    return "other";
  }
}
