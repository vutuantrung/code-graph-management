import * as path from "path";
import { GraphData, GraphEdge, GraphNode } from "./types";
import { scanWorkspaceFiles } from "./scanWorkspace";
import { extractRelativeImports } from "./parseImports";
import * as vscode from "vscode";

export async function buildGraph(): Promise<GraphData> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    console.log("[buildGraph] no workspace folder");
    return { nodes: [], edges: [] };
  }

  const root = folders[0].uri.fsPath;
  const files = await scanWorkspaceFiles();

  console.log("[buildGraph] total files:", files.length);

  const normalizedFiles = files.map((file) => path.normalize(file));

  const nodes: GraphNode[] = normalizedFiles.map((file) => ({
    id: file,
    label: path.relative(root, file),
    path: file,
  }));

  const nodeSet = new Set(normalizedFiles);
  const edgeMap = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const file of normalizedFiles) {
    let imports: string[] = [];

    try {
      imports = extractRelativeImports(file).map((p) => path.normalize(p));
      console.log("[buildGraph] file:", file);
      console.log("[buildGraph] imports:", imports);
    } catch (error) {
      console.error("[buildGraph] parse failed:", file, error);
      continue;
    }

    for (const imported of imports) {
      if (!nodeSet.has(imported)) {
        console.log("[buildGraph] skipped import not in nodeSet:", imported);
        continue;
      }

      const key = `${file}-->${imported}`;
      if (!edgeMap.has(key)) {
        edgeMap.add(key);
        edges.push({
          id: key,
          source: file,
          target: imported,
          type: "import",
        });
        console.log("[buildGraph] edge added:", key);
      }
    }
  }

  console.log("[buildGraph] final nodes:", nodes.length);
  console.log("[buildGraph] final edges:", edges.length);

  return { nodes, edges };
}