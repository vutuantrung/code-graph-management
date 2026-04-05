import * as vscode from "vscode";
import { buildGraph } from "./buildGraph";
import { GraphData } from "./types";
import { GraphIndex } from "./graphIndex";

export class GraphService {
    private graph: GraphData = { nodes: [], edges: [] };
    private index = new GraphIndex(this.graph);

    public async refresh(): Promise<GraphData> {
        this.graph = await buildGraph();
        this.index = new GraphIndex(this.graph);
        return this.graph;
    }

    public getGraph(): GraphData {
        return this.graph;
    }

    public getIndex(): GraphIndex {
        return this.index;
    }

    public async openNode(nodeId: string): Promise<void> {
        const node = this.index.getNode(nodeId);
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }

        const doc = await vscode.workspace.openTextDocument(node.path);
        await vscode.window.showTextDocument(doc);
    }
}