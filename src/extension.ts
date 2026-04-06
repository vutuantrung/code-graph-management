import * as vscode from "vscode";
import { GraphService } from "./graph/graphService";
import { GraphPanel } from "./webview/GraphPanel";
import { SymbolService } from "./symbols/symbolService";
import { SymbolExplorerService } from "./symbols/symbolExplorerService";

export function activate(context: vscode.ExtensionContext): void {
  const graphService = new GraphService();
  const symbolService = new SymbolService();
  const symbolExplorerService = new SymbolExplorerService();

  const openGraphCommand = vscode.commands.registerCommand("my-codegraph.openGraph", async () => {
    await graphService.refresh();
    const panel = GraphPanel.createOrShow(
      context.extensionUri,
      graphService,
      symbolService,
      symbolExplorerService
    );
    panel.setInitialGraph();
  });

  const showSymbolReferencesCommand = vscode.commands.registerCommand(
    "my-codegraph.showSymbolReferences",
    async () => {
      try {
        const items = await symbolService.getReferencesAtActiveCursor();
        const panel = GraphPanel.createOrShow(
          context.extensionUri,
          graphService,
          symbolService,
          symbolExplorerService
        );
        panel.ensureHtmlLoaded();
        panel.postMessage({ type: "referencesFound", items });

        if (items.length === 0) {
          void vscode.window.showInformationMessage("No references found.");
        }
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }
  );

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx,js,jsx}");
  const refreshPanel = async (): Promise<void> => {
    if (!GraphPanel.currentPanel) {
      return;
    }

    await graphService.refresh();
    GraphPanel.currentPanel.postMessage({
      type: "graphUpdated",
      graph: graphService.getGraph(),
    });
  };

  watcher.onDidCreate(refreshPanel);
  watcher.onDidChange(refreshPanel);
  watcher.onDidDelete(refreshPanel);

  context.subscriptions.push(openGraphCommand, showSymbolReferencesCommand, watcher);
}

export function deactivate(): void {
  // no-op
}
