import ELK from 'elkjs/lib/elk.bundled.js';
import type { FlowGraph, GraphNode } from './flowGraph';

export type Positions = Record<string, { x: number; y: number }>;

/** The size each node is drawn at; the layout and the node components share it */
export const NODE_SIZE: Record<GraphNode['type'], { width: number; height: number }> = {
    step: { width: 272, height: 92 },
    trigger: { width: 272, height: 64 },
    start: { width: 200, height: 40 },
    add: { width: 36, height: 36 },
};

const elk = new ELK();

/**
 * Places every node top to bottom with ELK's layered layout. A branching node's outlets are ports in their
 * drawn order, so branches keep their sides; loop-back edges are left out so a loop never turns the graph over.
 */
export async function layoutGraph(graph: FlowGraph): Promise<Positions> {
    const ports = new Map<string, string[]>();
    for (const node of graph.nodes) if (node.type === 'step') ports.set(node.id, node.data.outlets.map(outlet => outlet.id));
    const result = await elk.layout({
        id: 'flow',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'DOWN',
            'elk.layered.spacing.nodeNodeBetweenLayers': '64',
            'elk.spacing.nodeNode': '48',
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        },
        children: graph.nodes.map(node => ({
            id: node.id, ...NODE_SIZE[node.type],
            layoutOptions: { 'elk.portConstraints': 'FIXED_ORDER' },
            ports: (ports.get(node.id) ?? []).map(port => ({ id: `${node.id}::${port}`, layoutOptions: { 'elk.port.side': 'SOUTH' } })),
        })),
        edges: graph.edges.filter(edge => edge.kind !== 'loop').map(edge => ({
            id: edge.id,
            sources: [edge.sourceHandle && ports.get(edge.source)?.includes(edge.sourceHandle) ? `${edge.source}::${edge.sourceHandle}` : edge.source],
            targets: [edge.target],
        })),
    });
    return Object.fromEntries((result.children ?? []).map(child => [child.id, { x: Math.round(child.x ?? 0), y: Math.round(child.y ?? 0) }]));
}
