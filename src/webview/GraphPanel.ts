import * as vscode from "vscode";
import { GraphService } from "../graph/graphService";
import { ReferenceResultItem, SerializableRange, SymbolRef } from "../graph/types";
import { SymbolExplorerService } from "../symbols/symbolExplorerService";
import { SymbolService } from "../symbols/symbolService";

interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

export class GraphPanel {
  public static currentPanel: GraphPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly graphService: GraphService;
  private readonly symbolService: SymbolService;
  private readonly symbolExplorerService: SymbolExplorerService;
  private htmlLoaded = false;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    graphService: GraphService,
    symbolService: SymbolService,
    symbolExplorerService: SymbolExplorerService
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.graphService = graphService;
    this.symbolService = symbolService;
    this.symbolExplorerService = symbolExplorerService;

    this.panel.onDidDispose(() => {
      GraphPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this.handleMessage(message);
    });
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    graphService: GraphService,
    symbolService: SymbolService,
    symbolExplorerService: SymbolExplorerService
  ): GraphPanel {
    if (GraphPanel.currentPanel) {
      GraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return GraphPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel("codeGraph", "Code Graph", vscode.ViewColumn.One, {
      enableScripts: true,
    });

    GraphPanel.currentPanel = new GraphPanel(
      panel,
      extensionUri,
      graphService,
      symbolService,
      symbolExplorerService
    );

    return GraphPanel.currentPanel;
  }

  public setInitialGraph(): void {
    const graph = this.graphService.getGraph();
    this.panel.webview.html = this.getHtml(graph);
    this.htmlLoaded = true;
  }

  public ensureHtmlLoaded(): void {
    if (!this.htmlLoaded) {
      this.setInitialGraph();
    }
  }

  public postMessage(message: unknown): void {
    void this.panel.webview.postMessage(message);
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      switch (message.type) {
        case "refreshGraph": {
          const graph = await this.graphService.refresh();
          this.postMessage({ type: "graphUpdated", graph });
          return;
        }
        case "openNode": {
          await this.graphService.openNode(String(message.nodeId));
          return;
        }
        case "inspectNode": {
          const nodeId = String(message.nodeId);
          const relations = this.graphService.getIndex().getRelations(nodeId);
          this.postMessage({ type: "nodeDetails", nodeId, relations });
          return;
        }
        case "searchNodes": {
          const query = String(message.query ?? "");
          const nodes = this.graphService.getIndex().searchNodes(query);
          this.postMessage({ type: "searchResults", query, nodes });
          return;
        }
        case "getTopConnected": {
          const rawLimit = Number(message.limit ?? 20);
          const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
          const nodes = this.graphService.getIndex().getTopConnected(limit);
          this.postMessage({ type: "topConnectedResults", nodes });
          return;
        }
        case "openReference": {
          const item = message.item as ReferenceResultItem;
          await this.symbolService.openReference(item);
          return;
        }
        case "listSymbols": {
          const uri = vscode.Uri.parse(String(message.uri));
          const symbols = await this.symbolExplorerService.listDocumentSymbols(uri);
          this.postMessage({ type: "symbolsListed", uri: uri.toString(), symbols });
          return;
        }
        case "inspectSymbol": {
          const symbol = message.symbol as SymbolRef;
          const result = await this.symbolExplorerService.inspectSymbol(symbol);
          this.postMessage({ type: "symbolInspected", result });
          return;
        }
        case "openSymbol": {
          const symbol = message.symbol as SymbolRef;
          await this.symbolExplorerService.openSymbol(symbol);
          return;
        }
        case "openLocation": {
          const uri = String(message.uri);
          const range = message.range as SerializableRange;
          await this.symbolExplorerService.openLocation(uri, range);
          return;
        }
        default:
          throw new Error(`Unsupported message type: ${String(message.type)}`);
      }
    } catch (error) {
      this.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getHtml(graph: unknown): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "graph.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "graph.css"));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Code Graph</title>
</head>
<body>
  <div id="app"></div>
  <script>
    window.__GRAPH_DATA__ = ${JSON.stringify(graph)};
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
