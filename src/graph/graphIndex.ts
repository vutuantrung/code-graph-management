import { GraphData, GraphEdge, GraphNode, NodeRelations } from "./types";

export class GraphIndex {
  private readonly nodeById = new Map<string, GraphNode>();
  private readonly outgoingByNode = new Map<string, GraphEdge[]>();
  private readonly incomingByNode = new Map<string, GraphEdge[]>();

  constructor(private readonly graph: GraphData) {
    for (const node of graph.nodes) {
      this.nodeById.set(node.id, node);
      this.outgoingByNode.set(node.id, []);
      this.incomingByNode.set(node.id, []);
    }

    for (const edge of graph.edges) {
      if (!this.outgoingByNode.has(edge.source)) {
        this.outgoingByNode.set(edge.source, []);
      }
      if (!this.incomingByNode.has(edge.target)) {
        this.incomingByNode.set(edge.target, []);
      }

      this.outgoingByNode.get(edge.source)!.push(edge);
      this.incomingByNode.get(edge.target)!.push(edge);
    }
  }

  public getGraph(): GraphData {
    return this.graph;
  }

  public getNode(nodeId: string): GraphNode | undefined {
    return this.nodeById.get(nodeId);
  }

  public getOutgoing(nodeId: string): GraphEdge[] {
    return this.outgoingByNode.get(nodeId) ?? [];
  }

  public getIncoming(nodeId: string): GraphEdge[] {
    return this.incomingByNode.get(nodeId) ?? [];
  }

  public getRelations(nodeId: string): NodeRelations {
    const outgoing = this.getOutgoing(nodeId);
    const incoming = this.getIncoming(nodeId);

    const dependencies = outgoing
      .map((edge) => this.getNode(edge.target))
      .filter((node): node is GraphNode => Boolean(node));

    const dependents = incoming
      .map((edge) => this.getNode(edge.source))
      .filter((node): node is GraphNode => Boolean(node));

    return {
      incoming,
      outgoing,
      dependencies,
      dependents,
    };
  }

  public searchNodes(keyword: string): GraphNode[] {
    const q = keyword.trim().toLowerCase();
    if (!q) {
      return this.graph.nodes;
    }

    return this.graph.nodes.filter((node) =>
      node.label.toLowerCase().includes(q) ||
      node.path.toLowerCase().includes(q)
    );
  }

  public getTopConnected(limit = 20): Array<GraphNode & { degree: number }> {
    return this.graph.nodes
      .map((node) => {
        const degree = this.getIncoming(node.id).length + this.getOutgoing(node.id).length;
        return { ...node, degree };
      })
      .sort((a, b) => b.degree - a.degree)
      .slice(0, limit);
  }
}