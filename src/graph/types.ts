export interface GraphNode {
    id: string;
    label: string;
    path: string;
    ext?: string;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: "import" | "call";
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface GraphStats {
    nodeCount: number;
    edgeCount: number;
}

export interface NodeRelations {
    incoming: GraphEdge[];
    outgoing: GraphEdge[];
    dependencies: GraphNode[];
    dependents: GraphNode[];
}

export interface ReferenceResultItem {
    id: string;
    filePath: string;
    uri: string;
    line: number;
    column: number;
    preview: string;
    kind: "call" | "type" | "import" | "export" | "declaration" | "other";
}