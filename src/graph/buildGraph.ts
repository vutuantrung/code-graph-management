import * as path from "path";
import * as vscode from "vscode";
import { scanWorkspaceFiles } from "./scanWorkspace";
import { extractRelativeImports } from "./parseImports";
import { GraphData, GraphEdge, GraphNode } from "./types";

export async function buildGraph(): Promise<GraphData> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    console.log("[buildGraph] no workspace folders");
    return { nodes: [], edges: [] };
  }

  const files = await scanWorkspaceFiles();
  const normalizedFiles = files.map((file) => path.normalize(file));

  const nodes: GraphNode[] = normalizedFiles.map((file) => ({
    id: file,
    label: getWorkspaceRelativePath(file),
    path: file,
    ext: path.extname(file),
  }));

  const nodeSet = new Set(normalizedFiles);
  const edgeMap = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const file of normalizedFiles) {
    let imports: string[] = [];

    try {
      imports = extractRelativeImports(file).map((entry) => path.normalize(entry));
    } catch (error) {
      console.error("[buildGraph] parse failed:", file, error);
      continue;
    }

    for (const imported of imports) {
      if (!nodeSet.has(imported)) {
        continue;
      }

      const edgeId = `${file}-->${imported}`;
      if (edgeMap.has(edgeId)) {
        continue;
      }

      edgeMap.add(edgeId);
      edges.push({
        id: edgeId,
        source: file,
        target: imported,
        type: "import",
      });
    }
  }

  console.log("[buildGraph] final nodes:", nodes.length);
  console.log("[buildGraph] final edges:", edges.length);

  return { nodes, edges };
}

function getWorkspaceRelativePath(filePath: string): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!workspaceFolder) {
    return path.basename(filePath);
  }

  return path.relative(workspaceFolder.uri.fsPath, filePath);
}
