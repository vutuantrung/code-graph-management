// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { buildGraph } from "./graph/buildGraph";
import { GraphPanel } from "./webview/GraphPanel";
import { GraphService } from './graph/graphService';
import { SymbolService } from './symbols/symbolService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json

    const graphService = new GraphService();
    const symbolService = new SymbolService();

    // Register command to open graph panel
    const openGraphCommand = vscode.commands.registerCommand(
        "my-codegraph.openGraph",
        async () => {
            await graphService.refresh();
            const panel = GraphPanel.createOrShow(context.extensionUri, graphService, symbolService);
            panel.setInitialGraph();
        }
    );


    // Register command to show symbol references
    const showSymbolReferencesCommand = vscode.commands.registerCommand(
        "my-codegraph.showSymbolReferences",
        async () => {
            try {
                const items = await symbolService.getReferencesAtActiveCursor();

                const panel = GraphPanel.createOrShow(context.extensionUri, graphService, symbolService);
                panel.ensureHtmlLoaded();
                panel.postMessage({
                    type: "referencesFound",
                    items,
                });

                if (items.length === 0) {
                    vscode.window.showInformationMessage("No references found.");
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    error instanceof Error ? error.message : String(error)
                );
            }
        }
    );


    // Automatically refresh graph when files change
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx,js,jsx}");
    const refreshPanel = async () => {
        if (!GraphPanel.currentPanel) { return; }
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

// This method is called when your extension is deactivated
export function deactivate() { }
