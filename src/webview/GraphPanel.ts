import * as vscode from "vscode";
import { GraphService } from "../graph/graphService";
import { SymbolService, ReferenceResultItem } from "../symbols/symbolService";

export class GraphPanel {
    public static currentPanel: GraphPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly graphService: GraphService;
    private readonly symbolService: SymbolService;
    private htmlLoaded = false;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        graphService: GraphService,
        symbolService: SymbolService
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.graphService = graphService;
        this.symbolService = symbolService;

        this.panel.onDidDispose(() => {
            GraphPanel.currentPanel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case "refreshGraph": {
                        const graph = await this.graphService.refresh();
                        this.postMessage({ type: "graphUpdated", graph });
                        return;
                    }

                    case "openNode": {
                        await this.graphService.openNode(message.nodeId);
                        return;
                    }

                    case "inspectNode": {
                        const relations = this.graphService.getIndex().getRelations(message.nodeId);
                        this.postMessage({
                            type: "nodeDetails",
                            nodeId: message.nodeId,
                            relations,
                        });
                        return;
                    }

                    case "searchNodes": {
                        const nodes = this.graphService.getIndex().searchNodes(message.query ?? "");
                        this.postMessage({
                            type: "searchResults",
                            query: message.query ?? "",
                            nodes,
                        });
                        return;
                    }

                    case "getTopConnected": {
                        const nodes = this.graphService.getIndex().getTopConnected(message.limit ?? 20);
                        this.postMessage({
                            type: "topConnectedResults",
                            nodes,
                        });
                        return;
                    }

                    case "openReference": {
                        const item = message.item as ReferenceResultItem;
                        await this.symbolService.openReference(item);
                        return;
                    }
                }
            } catch (error) {
                this.postMessage({
                    type: "error",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        graphService: GraphService,
        symbolService: SymbolService
    ): GraphPanel {
        if (GraphPanel.currentPanel) {
            GraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
            return GraphPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            "codeGraph",
            "Code Graph",
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        GraphPanel.currentPanel = new GraphPanel(panel, extensionUri, graphService, symbolService);
        return GraphPanel.currentPanel;
    }

    public setInitialGraph() {
        const graph = this.graphService.getGraph();
        this.panel.webview.html = this.getHtml(graph);
        this.htmlLoaded = true;
    }

    public ensureHtmlLoaded() {
        if (!this.htmlLoaded) {
            this.setInitialGraph();
        }
    }

    public postMessage(message: unknown) {
        this.panel.webview.postMessage(message);
    }

    private getHtml(graph: unknown): string {
        const webview = this.panel.webview;
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "media", "graph.js")
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "media", "graph.css")
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';"
  />
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