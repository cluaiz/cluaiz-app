import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow,
    type Connection, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './flowTheme.css';
import type { FlowGraph, GraphEdge, GraphNode } from '../model/flowGraph';
import { layoutGraph, type Positions } from '../model/layout';
import { EDGE_TYPES } from './FlowEdge';
import { NODE_TYPES } from './FlowNodes';
import { FlowCanvasContext, type CanvasContext } from './canvasContext';

export interface FlowCanvasProps extends CanvasContext {
    graph: FlowGraph;
    /** Places the owner moved nodes to (kept in the file's `ui`); the rest come from the layout */
    pinned: Positions;
    selected: string | null;
    miniMap: boolean;
    onSelect: (id: string | null) => void;
    onMoved: (id: string, position: { x: number; y: number }) => void;
    onConnect: (source: string, target: string) => void;
    onRemove: (ids: string[]) => void;
    onContextMenu: (id: string, x: number, y: number) => void;
    onDropItem: (raw: string) => void;
}

/** A change in what is drawn, not in what the nodes say: only this lays the graph out again */
const shape = (graph: FlowGraph) =>
    `${graph.nodes.map(node => node.id).join('|')}#${graph.edges.map(edge => `${edge.source}>${edge.target}:${edge.sourceHandle ?? ''}`).join('|')}`;

export const DRAG_TYPE = 'application/x-cluaiz-flow-item';

function Canvas({ graph, pinned, selected, miniMap, onSelect, onMoved, onConnect, onRemove, onContextMenu, onDropItem, ...context }: FlowCanvasProps) {
    const [laid, setLaid] = useState<Positions>({});
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const { fitView } = useReactFlow();
    const fitted = useRef(false);
    const latest = useRef(graph);
    latest.current = graph;
    const key = shape(graph);

    useEffect(() => {
        let alive = true;
        layoutGraph(latest.current).then(positions => { if (alive) setLaid(positions); }).catch(() => {});
        return () => { alive = false; };
    }, [key]);

    useEffect(() => {
        setNodes(graph.nodes.map((node: GraphNode) => ({
            id: node.id, type: node.type, data: node.data, selected: node.id === selected,
            position: pinned[node.id] ?? laid[node.id] ?? { x: 0, y: 0 },
            deletable: node.type === 'step' || node.type === 'trigger',
            draggable: node.type !== 'add',
        })));
    }, [graph, laid, pinned, selected, setNodes]);

    useEffect(() => {
        if (fitted.current || !Object.keys(laid).length) return;
        fitted.current = true;
        requestAnimationFrame(() => void fitView({ padding: 0.2, maxZoom: 1 }));
    }, [laid, fitView]);

    const edges = useMemo<Edge[]>(() => graph.edges.map((edge: GraphEdge) => ({
        id: edge.id, source: edge.source, target: edge.target, type: 'flow',
        sourceHandle: edge.sourceHandle ?? null, targetHandle: edge.targetHandle ?? null,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--text-muted)' },
        animated: context.statuses[edge.target] === 'running' || context.statuses[edge.source] === 'running',
        deletable: false, data: { edge },
    })), [graph, context.statuses]);

    const steps = useMemo(() => new Set(graph.nodes.filter(node => node.type === 'step').map(node => node.id)), [graph]);

    return <FlowCanvasContext.Provider value={context}>
        <div className="flow-canvas w-full h-full" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
            onDrop={event => { const raw = event.dataTransfer.getData(DRAG_TYPE); if (raw) { event.preventDefault(); onDropItem(raw); } }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
                onNodesChange={onNodesChange} minZoom={0.2} maxZoom={1.75} proOptions={{ hideAttribution: true }}
                deleteKeyCode={['Delete', 'Backspace']} snapToGrid snapGrid={[8, 8]}
                onNodeClick={(_, node) => onSelect(node.type === 'add' ? null : node.id)}
                onPaneClick={() => onSelect(null)}
                onNodeDragStop={(_, node) => onMoved(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) })}
                onNodesDelete={removed => onRemove(removed.map(node => node.id))}
                onNodeContextMenu={(event, node) => { event.preventDefault(); if (node.type === 'step' || node.type === 'trigger') onContextMenu(node.id, event.clientX, event.clientY); }}
                isValidConnection={(connection: Connection | Edge) => connection.source !== connection.target && steps.has(connection.source) && steps.has(connection.target)}
                onConnect={connection => onConnect(connection.source, connection.target)}>
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
                <Controls showInteractive={false} position="bottom-left" />
                {miniMap && <MiniMap pannable zoomable position="bottom-right" />}
            </ReactFlow>
        </div>
    </FlowCanvasContext.Provider>;
}

/** The flow drawn with React Flow; every change goes back to the caller, which changes the file */
export function FlowCanvas(props: FlowCanvasProps) {
    return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
