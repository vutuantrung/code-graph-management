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

export type ReferenceKind = "call" | "type" | "import" | "export" | "declaration" | "other";

export interface ReferenceResultItem {
  id: string;
  filePath: string;
  uri: string;
  line: number;
  column: number;
  preview: string;
  kind: ReferenceKind;
}

export interface SerializableRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export type SymbolKindLabel =
  | "file"
  | "module"
  | "namespace"
  | "class"
  | "method"
  | "function"
  | "constructor"
  | "property"
  | "field"
  | "variable"
  | "interface"
  | "enum"
  | "typeParameter"
  | "constant"
  | "unknown";

export interface SymbolRef {
  id: string;
  uri: string;
  name: string;
  detail?: string;
  kind: SymbolKindLabel;
  containerName?: string;
  range: SerializableRange;
  selectionRange: SerializableRange;
}

export interface SymbolReferenceResult {
  uri: string;
  range: SerializableRange;
  preview: string;
  kind: ReferenceKind;
}

export interface SymbolCallResult {
  symbol: SymbolRef;
  fromRanges: SerializableRange[];
}

export interface SymbolInspectionResult {
  symbol: SymbolRef;
  references: SymbolReferenceResult[];
  incomingCalls: SymbolCallResult[];
  outgoingCalls: SymbolCallResult[];
}
