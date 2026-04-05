// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { buildGraph } from "./graph/buildGraph";
import { GraphPanel } from "./webview/GraphPanel";
import { GraphService } from './graph/graphService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const graphService = new GraphService();
	// Register command to open graph panel
	{
		const disposable = vscode.commands.registerCommand(
			"my-codegraph.openGraph",
			async () => {
				// build graph first
				await graphService.refresh();

				// create panel
				const panel = GraphPanel.createOrShow(context.extensionUri, graphService);

				// send initial data
				panel.setInitialGraph();
			}
		);
		context.subscriptions.push(disposable);
	}

	// Register command to show symbol references
	// {
	// 	const disposable = vscode.commands.registerCommand(
	// 		"my-codegraph.openGraph",
	// 		async () => {
	// 			const editor = vscode.window.activeTextEditor;
	// 			if (!editor) {
	// 				vscode.window.showErrorMessage("No active editor found");
	// 				return;
	// 			}

	// 			const uri = editor.document.uri;
	// 			const position = editor.selection.active;

	// 			try {
	// 				const references = await vscode.commands.executeCommand<vscode.Location[]>(
	// 					"vscode.executeReferenceProvider",
	// 					uri,
	// 					position
	// 				);

	// 				if (!references || references.length === 0) {
	// 					vscode.window.showInformationMessage("No references found");
	// 					return;
	// 				}

	// 				console.log("References:", references);

	// 				const items = await Promise.all(
	// 					references.map(async (ref) => {
	// 						const doc = await vscode.workspace.openTextDocument(ref.uri);
	// 						const line = doc.lineAt(ref.range.start.line);
	// 						return {
	// 							uri: ref.uri.toString(),
	// 							fsPath: ref.uri.fsPath,
	// 							line: ref.range.start.line + 1,
	// 							column: ref.range.start.character + 1,
	// 							preview: line,
	// 						};
	// 					})
	// 				);
	// 				console.log("Reference items:", items);
	// 				vscode.window.showInformationMessage(`Found ${items.length} references. Check logs.`);
	// 			} catch (error) {
	// 				console.error("Failed to fetch references:", error);
	// 				vscode.window.showErrorMessage("Failed to fetch symbol references.");
	// 			}
	// 		}
	// 	);
	// 	context.subscriptions.push(disposable);
	// }

	// Automatically refresh graph when files change
	{
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

		context.subscriptions.push(watcher);
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
