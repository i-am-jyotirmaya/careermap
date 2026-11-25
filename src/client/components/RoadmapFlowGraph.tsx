import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDot,
  Compass,
  Crown,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  CareerStream,
  RoadmapGraphEdge,
  StreamPhase,
  StreamTopic,
} from '../../shared/types.ts';

export interface RoadmapFlowGraphProps {
  stream: CareerStream;
  activeTopicId: string;
  onSelectTopic: (topicId: string) => void;
  animationsEnabled?: boolean;
}

const COL_WIDTH = 248;
const COL_GAP = 88;
const NODE_HEIGHT = 108;
const ROW_GAP = 34;
const TOP_HEADER = 64;
const PAD_X = 28;
const PAD_Y = 24;

const PHASE_HEADER_PALETTE = [
  'bg-[#88AAEE]',
  'bg-[#A985FF]',
  'bg-[#FFDC58]',
  'bg-[#05E17A]',
  'bg-[#22D3EE]',
] as const;

type EdgeTone = 'mastered' | 'active' | 'boss' | 'upcoming';

interface PositionedTopicNode {
  topic: StreamTopic;
  phase: StreamPhase;
  phaseIndex: number;
  topicIndex: number;
  x: number;
  y: number;
}

interface PositionedPhaseColumn {
  phase: StreamPhase;
  phaseIndex: number;
  x: number;
  y: number;
  masteredCount: number;
  avgMastery: number;
}

interface ComputedSvgEdge {
  edge: RoadmapGraphEdge;
  pathD: string;
  startX: number;
  startY: number;
  tone: EdgeTone;
  isAnimated: boolean;
  isHighlighted: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildFallbackRoadmapEdges(phases: StreamPhase[]): RoadmapGraphEdge[] {
  const edges: RoadmapGraphEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (
    fromTopicId: string,
    toTopicId: string,
    kind: RoadmapGraphEdge['kind']
  ) => {
    if (!fromTopicId || !toTopicId || fromTopicId === toTopicId) return;
    const key = `${fromTopicId}->${toTopicId}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: key, fromTopicId, toTopicId, kind });
  };

  for (const phase of phases) {
    for (let i = 0; i < phase.topics.length - 1; i++) {
      const curr = phase.topics[i];
      const next = phase.topics[i + 1];
      if (!curr || !next) continue;
      addEdge(
        curr.id,
        next.id,
        next.isBossTopic ? 'boss_convergence' : 'intra_phase'
      );
    }
  }

  for (let p = 0; p < phases.length - 1; p++) {
    const currPhase = phases[p];
    const nextPhase = phases[p + 1];
    if (!currPhase || !nextPhase) continue;
    if (currPhase.topics.length === 0 || nextPhase.topics.length === 0) continue;

    const pairCount = Math.min(currPhase.topics.length, nextPhase.topics.length);
    for (let i = 0; i < pairCount; i++) {
      const fromT = currPhase.topics[i];
      const toT = nextPhase.topics[i];
      if (!fromT || !toT) continue;
      addEdge(
        fromT.id,
        toT.id,
        toT.isBossTopic ? 'boss_convergence' : 'cross_phase'
      );
    }

    const lastCurr = currPhase.topics[currPhase.topics.length - 1];
    const firstNext = nextPhase.topics[0];
    if (lastCurr && firstNext) {
      addEdge(lastCurr.id, firstNext.id, 'cross_phase');
    }
  }

  const lastPhase = phases[phases.length - 1];
  const prevPhase = phases.length >= 2 ? phases[phases.length - 2] : undefined;
  const bossNode = lastPhase?.topics.find((t) => t.isBossTopic);
  if (bossNode && prevPhase && prevPhase.topics.length > 0) {
    const prevFinal = prevPhase.topics[prevPhase.topics.length - 1];
    if (prevFinal) {
      addEdge(prevFinal.id, bossNode.id, 'boss_convergence');
    }
  }

  return edges;
}

export const RoadmapFlowGraph: React.FC<RoadmapFlowGraphProps> = ({
  stream,
  activeTopicId,
  onSelectTopic,
  animationsEnabled = true,
}) => {
  const rawUid = useId();
  const svgUid = useMemo(
    () => `rfg-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawUid]
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null);
  const shouldAnimate = animationsEnabled !== false;

  const orderedPhases = useMemo<StreamPhase[]>(
    () =>
      [...stream.phases]
        .sort((a, b) => a.phaseOrder - b.phaseOrder)
        .map((phase) => ({
          ...phase,
          topics: [...phase.topics].sort((a, b) => a.topicOrder - b.topicOrder),
        })),
    [stream.phases]
  );

  const effectiveEdges = useMemo<RoadmapGraphEdge[]>(() => {
    if (stream.roadmapEdges && stream.roadmapEdges.length > 0) {
      return stream.roadmapEdges;
    }
    return buildFallbackRoadmapEdges(orderedPhases);
  }, [stream.roadmapEdges, orderedPhases]);

  const layout = useMemo(() => {
    const phaseColumns: PositionedPhaseColumn[] = [];
    const nodes: PositionedTopicNode[] = [];
    const nodeById = new Map<string, PositionedTopicNode>();

    let maxTopicsInPhase = 1;

    orderedPhases.forEach((phase, pIdx) => {
      const colX = PAD_X + pIdx * (COL_WIDTH + COL_GAP);
      if (phase.topics.length > maxTopicsInPhase) {
        maxTopicsInPhase = phase.topics.length;
      }

      const masteredCount = phase.topics.filter(
        (t) => t.status === 'mastered'
      ).length;
      const avgMastery =
        phase.topics.length > 0
          ? Math.round(
              phase.topics.reduce((acc, t) => acc + t.masteryScore, 0) /
                phase.topics.length
            )
          : 0;

      phaseColumns.push({
        phase,
        phaseIndex: pIdx,
        x: colX,
        y: PAD_Y,
        masteredCount,
        avgMastery,
      });

      phase.topics.forEach((topic, tIdx) => {
        const nodeY = PAD_Y + TOP_HEADER + tIdx * (NODE_HEIGHT + ROW_GAP);
        const positioned: PositionedTopicNode = {
          topic,
          phase,
          phaseIndex: pIdx,
          topicIndex: tIdx,
          x: colX,
          y: nodeY,
        };
        nodes.push(positioned);
        nodeById.set(topic.id, positioned);
      });
    });

    const canvasWidth = Math.max(
      360,
      PAD_X * 2 +
        orderedPhases.length * COL_WIDTH +
        Math.max(0, orderedPhases.length - 1) * COL_GAP
    );
    const canvasHeight =
      PAD_Y * 2 +
      TOP_HEADER +
      maxTopicsInPhase * NODE_HEIGHT +
      Math.max(0, maxTopicsInPhase - 1) * ROW_GAP;

    const computedEdges: ComputedSvgEdge[] = [];

    for (const edge of effectiveEdges) {
      const fromNode = nodeById.get(edge.fromTopicId);
      const toNode = nodeById.get(edge.toTopicId);
      if (!fromNode || !toNode) continue;

      const fromStatus = fromNode.topic.status;
      const toStatus = toNode.topic.status;
      const touchesActive =
        edge.fromTopicId === activeTopicId || edge.toTopicId === activeTopicId;
      const touchesHovered =
        hoveredTopicId !== null &&
        (edge.fromTopicId === hoveredTopicId || edge.toTopicId === hoveredTopicId);
      const touchesInProgress =
        fromStatus === 'in_progress' || toStatus === 'in_progress';
      const isFrontierUnlock =
        fromStatus === 'mastered' && toStatus !== 'mastered';

      let tone: EdgeTone;
      if (fromStatus === 'mastered' && toStatus === 'mastered') {
        tone = 'mastered';
      } else if (edge.kind === 'boss_convergence') {
        tone = 'boss';
      } else if (touchesActive || touchesInProgress || isFrontierUnlock) {
        tone = 'active';
      } else {
        tone = 'upcoming';
      }

      const isAnimated =
        tone === 'mastered' ||
        touchesActive ||
        touchesInProgress ||
        edge.kind === 'boss_convergence' ||
        isFrontierUnlock;

      let pathD = '';
      let startX = 0;
      let startY = 0;

      if (fromNode.phaseIndex === toNode.phaseIndex) {
        // Same-column vertical / curved cubic Bezier arrow (intra_phase or intra-column boss convergence)
        const goingDown = toNode.y >= fromNode.y;
        const x1 = fromNode.x + COL_WIDTH / 2;
        const y1 = goingDown ? fromNode.y + NODE_HEIGHT : fromNode.y;
        const x2 = toNode.x + COL_WIDTH / 2;
        const y2 = goingDown ? toNode.y - 3 : toNode.y + NODE_HEIGHT + 3;
        startX = x1;
        startY = y1;

        const rowSpan = Math.abs(toNode.topicIndex - fromNode.topicIndex);
        if (rowSpan <= 1) {
          const dy = Math.max(12, Math.abs(y2 - y1) * 0.45);
          const dir = goingDown ? 1 : -1;
          pathD = `M ${x1} ${y1} C ${x1} ${y1 + dir * dy}, ${x2} ${y2 - dir * dy}, ${x2} ${y2}`;
        } else {
          // Arc gracefully around intermediate nodes if skipping rows in same column
          const arcX = fromNode.x + COL_WIDTH + 22;
          pathD = `M ${fromNode.x + COL_WIDTH} ${fromNode.y + NODE_HEIGHT / 2} C ${arcX} ${fromNode.y + NODE_HEIGHT / 2}, ${arcX} ${toNode.y + NODE_HEIGHT / 2}, ${toNode.x + COL_WIDTH + 3} ${toNode.y + NODE_HEIGHT / 2}`;
          startX = fromNode.x + COL_WIDTH;
          startY = fromNode.y + NODE_HEIGHT / 2;
        }
      } else {
        // Cross-phase or Boss Convergence fluid S-curve cubic Bezier path
        const goingRight = toNode.x >= fromNode.x;
        const rowDelta = toNode.topicIndex - fromNode.topicIndex;
        const portOffset = clamp(rowDelta * 9, -22, 22);

        const x1 = goingRight ? fromNode.x + COL_WIDTH : fromNode.x;
        const y1 = fromNode.y + NODE_HEIGHT / 2 + portOffset;
        const x2 = goingRight ? toNode.x - 4 : toNode.x + COL_WIDTH + 4;
        const y2 = toNode.y + NODE_HEIGHT / 2 - portOffset;

        startX = x1;
        startY = y1;

        const spanX = Math.abs(x2 - x1);
        const dx = Math.max(42, spanX * 0.52) * (goingRight ? 1 : -1);
        pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      }

      computedEdges.push({
        edge,
        pathD,
        startX,
        startY,
        tone,
        isAnimated,
        isHighlighted: touchesActive || touchesHovered,
      });
    }

    // Draw upcoming/static edges first and active/boss/highlighted edges on top
    const priorityScore = (e: ComputedSvgEdge): number => {
      if (e.isHighlighted) return 4;
      if (e.tone === 'active') return 3;
      if (e.tone === 'boss') return 2;
      if (e.tone === 'mastered') return 1;
      return 0;
    };
    computedEdges.sort((a, b) => priorityScore(a) - priorityScore(b));

    const totalMastered = nodes.filter(
      (n) => n.topic.status === 'mastered'
    ).length;

    return {
      phaseColumns,
      nodes,
      nodeById,
      computedEdges,
      canvasWidth,
      canvasHeight,
      totalMastered,
    };
  }, [orderedPhases, effectiveEdges, activeTopicId, hoveredTopicId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const activePos = layout.nodeById.get(activeTopicId);
    if (!container || !activePos) return;

    const targetCenter = activePos.x + COL_WIDTH / 2;
    const desiredScrollLeft = Math.max(
      0,
      targetCenter - container.clientWidth / 2
    );
    container.scrollTo({
      left: desiredScrollLeft,
      behavior: shouldAnimate ? 'smooth' : 'auto',
    });
  }, [activeTopicId, layout.nodeById, shouldAnimate]);

  if (orderedPhases.length === 0) {
    return null;
  }

  const getToneBaseStroke = (tone: EdgeTone): string => {
    switch (tone) {
      case 'mastered':
        return '#059669';
      case 'active':
        return '#4F46E5';
      case 'boss':
        return '#D97706';
      case 'upcoming':
        return '#18181B';
    }
  };

  const getToneFlowDashColor = (tone: EdgeTone): string => {
    switch (tone) {
      case 'mastered':
        return '#05E17A';
      case 'active':
        return '#88AAEE';
      case 'boss':
        return '#FF9F43';
      case 'upcoming':
        return '#18181B';
    }
  };

  return (
    <section
      aria-label="Precomputed Roadmap Flow Graph"
      className="overflow-hidden rounded-base border-2 border-border bg-[#FFFDF7] shadow-shadow"
    >
      {/* Top Bar: Graph Summary & Quick Hint */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-secondary-background px-5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="yellow" className="uppercase tracking-wider">
            <Workflow className="h-3.5 w-3.5 text-black" />
            Precomputed Roadmap Flow
          </Badge>
          <span className="text-xs font-heading font-bold text-foreground">
            {orderedPhases.length}{' '}
            {orderedPhases.length === 1 ? 'Phase' : 'Phases'} ·{' '}
            <strong>{layout.nodes.length}</strong> Topic Nodes ·{' '}
            <span className="inline-flex items-center rounded-[4px] border border-black bg-[#05E17A] px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-black">
              {layout.totalMastered}/{layout.nodes.length} Mastered
            </span>{' '}
            ·{' '}
            <span className="text-muted-foreground">
              {layout.computedEdges.length} Directed Edges
            </span>
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-base border-2 border-black bg-[#88AAEE]/40 px-2.5 py-1 text-[11px] font-heading font-bold text-black shadow-[2px_2px_0px_0px_#000]">
          <Compass className="h-3.5 w-3.5 text-black" />
          <span>Click any node to jump directly across your roadmap</span>
        </div>
      </div>

      {/* Deterministic Coordinate Scroll Viewport */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto bg-[#FFFDF7]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #00000018 1px, transparent 1px), linear-gradient(to bottom, #00000018 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div
          className="relative mx-auto"
          style={{
            width: layout.canvasWidth,
            height: layout.canvasHeight,
          }}
        >
          {/* Layer 1: Exact-coordinate SVG Backdrop, Swimlanes & Fluid Bezier Arrow Edges */}
          <svg
            width={layout.canvasWidth}
            height={layout.canvasHeight}
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            className="pointer-events-none absolute inset-0 select-none"
            aria-hidden="true"
          >
            <defs>
              {/* Crisp Neobrutalist Architectural Grid */}
              <pattern
                id={`${svgUid}-arch-grid`}
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="#00000018"
                  strokeWidth="1"
                />
              </pattern>

              {/* High-Contrast Directional Arrowhead Markers */}
              <marker
                id={`${svgUid}-arrow-mastered`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerUnits="userSpaceOnUse"
                markerWidth="11"
                markerHeight="11"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1.5 L 10.5 6 L 1 10.5 z"
                  fill="#05E17A"
                  stroke="#000000"
                  strokeWidth="1.35"
                  strokeLinejoin="round"
                />
              </marker>

              <marker
                id={`${svgUid}-arrow-active`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerUnits="userSpaceOnUse"
                markerWidth="11.5"
                markerHeight="11.5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1.5 L 10.5 6 L 1 10.5 z"
                  fill="#88AAEE"
                  stroke="#000000"
                  strokeWidth="1.35"
                  strokeLinejoin="round"
                />
              </marker>

              <marker
                id={`${svgUid}-arrow-boss`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerUnits="userSpaceOnUse"
                markerWidth="11.5"
                markerHeight="11.5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1.5 L 10.5 6 L 1 10.5 z"
                  fill="#FF9F43"
                  stroke="#000000"
                  strokeWidth="1.35"
                  strokeLinejoin="round"
                />
              </marker>

              <marker
                id={`${svgUid}-arrow-upcoming`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerUnits="userSpaceOnUse"
                markerWidth="10.5"
                markerHeight="10.5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1.5 L 10.5 6 L 1 10.5 z"
                  fill="#18181B"
                  stroke="#000000"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </marker>
            </defs>

            {/* Architectural Grid Fill */}
            <rect
              x="0"
              y="0"
              width={layout.canvasWidth}
              height={layout.canvasHeight}
              fill={`url(#${svgUid}-arch-grid)`}
            />

            {/* Phase Swimlane Backdrops */}
            {layout.phaseColumns.map((col) => (
              <rect
                key={`lane-${col.phase.id}`}
                x={col.x - 10}
                y={PAD_Y - 8}
                width={COL_WIDTH + 20}
                height={layout.canvasHeight - (PAD_Y - 8) * 2}
                rx={6}
                fill="#FFFFFF"
                fillOpacity="0.65"
                stroke="#000000"
                strokeOpacity="0.22"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            ))}

            {/* Directed Fluid Bezier Edges */}
            {layout.computedEdges.map((item) => {
              const baseStroke = getToneBaseStroke(item.tone);
              const flowDashColor = getToneFlowDashColor(item.tone);
              const isUpcoming = item.tone === 'upcoming';

              const outerInkWidth = item.isHighlighted ? 5.2 : 4.2;
              const coreWidth = item.isHighlighted
                ? 2.8
                : isUpcoming
                  ? 2.1
                  : 2.4;
              const upcomingOpacity = item.isHighlighted ? 1 : 0.78;

              return (
                <g key={item.edge.id}>
                  {/* Highlight Aura on Active / Hovered Node Connections */}
                  {item.isHighlighted && (
                    <path
                      d={item.pathD}
                      fill="none"
                      stroke="#FFDC58"
                      strokeWidth={8.5}
                      strokeOpacity={0.55}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Crisp #000000 Outer Ink Casing for Mastered / Active / Boss Edges */}
                  {!isUpcoming && (
                    <path
                      d={item.pathD}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={outerInkWidth}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Primary Cubic Bezier Path with Arrowhead */}
                  <path
                    d={item.pathD}
                    fill="none"
                    stroke={baseStroke}
                    strokeWidth={coreWidth}
                    strokeOpacity={isUpcoming ? upcomingOpacity : 1}
                    strokeLinecap="round"
                    markerEnd={`url(#${svgUid}-arrow-${item.tone})`}
                  />

                  {/* Animated Fluid Flow Dash on Mastered / Active Frontier / Boss Convergence */}
                  {shouldAnimate && item.isAnimated && !isUpcoming && (
                    <path
                      d={item.pathD}
                      fill="none"
                      stroke={flowDashColor}
                      strokeWidth={item.isHighlighted ? 2.5 : 2.1}
                      strokeDasharray="7 7"
                      strokeLinecap="round"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="28"
                        to="0"
                        dur={item.tone === 'mastered' ? '2.2s' : '1.35s'}
                        repeatCount="indefinite"
                      />
                    </path>
                  )}

                  {/* Departure Port Node */}
                  <circle
                    cx={item.startX}
                    cy={item.startY}
                    r={item.isHighlighted ? 4 : 3.2}
                    fill={isUpcoming ? '#FFFFFF' : flowDashColor}
                    stroke="#000000"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>

          {/* Layer 2: Bold Neo-Pop Phase Column Headers */}
          {layout.phaseColumns.map((col) => {
            const allMastered =
              col.phase.topics.length > 0 &&
              col.masteredCount === col.phase.topics.length;
            const phaseBg =
              PHASE_HEADER_PALETTE[
                col.phaseIndex % PHASE_HEADER_PALETTE.length
              ] ?? 'bg-[#88AAEE]';

            return (
              <div
                key={col.phase.id}
                style={{
                  left: col.x,
                  top: col.y,
                  width: COL_WIDTH,
                  height: TOP_HEADER - 12,
                }}
                title={`${col.phase.title} — ${col.phase.objective}`}
                className={cn(
                  'absolute z-10 flex flex-col justify-between rounded-base border-2 border-black px-3 py-1.5 text-black shadow-[3px_3px_0px_0px_#000]',
                  phaseBg
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-heading text-[10px] font-black uppercase tracking-wider text-black">
                    Phase {col.phaseIndex + 1}
                  </span>
                  <span
                    className={cn(
                      'rounded-[4px] border border-black px-1.5 py-0 font-mono text-[10px] font-extrabold text-black',
                      allMastered ? 'bg-[#05E17A]' : 'bg-white'
                    )}
                  >
                    {col.masteredCount}/{col.phase.topics.length} ·{' '}
                    {col.avgMastery}%
                  </span>
                </div>
                <div className="truncate font-heading text-xs font-bold text-black">
                  {col.phase.title}
                </div>
              </div>
            );
          })}

          {/* Layer 3: Interactive Neobrutalist Topic Node Cards */}
          {layout.nodes.map((node) => {
            const { topic } = node;
            const isActive = topic.id === activeTopicId;
            const isMastered = topic.status === 'mastered';
            const isInProgress = topic.status === 'in_progress';
            const clampedMastery = clamp(Math.round(topic.masteryScore), 0, 100);

            const cardStateClasses = isActive
              ? 'bg-[#88AAEE] ring-2 ring-black -translate-x-[2px] -translate-y-[2px] shadow-[6px_6px_0px_0px_#000] z-20'
              : isMastered
                ? 'bg-[#D1FAE5] shadow-[4px_4px_0px_0px_#000] z-10 hover:z-20'
                : topic.isBossTopic
                  ? 'bg-[#FFDC58]/45 shadow-[4px_4px_0px_0px_#000] z-10 hover:z-20'
                  : isInProgress
                    ? 'bg-[#EEF2FF] shadow-[4px_4px_0px_0px_#000] z-10 hover:z-20'
                    : 'bg-white shadow-[4px_4px_0px_0px_#000] z-10 hover:z-20';

            const progressFillClass = isMastered
              ? 'bg-[#05E17A]'
              : topic.isBossTopic || isActive
                ? 'bg-[#FFDC58]'
                : isInProgress
                  ? 'bg-[#A985FF]'
                  : 'bg-black';

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSelectTopic(topic.id)}
                onMouseEnter={() => setHoveredTopicId(topic.id)}
                onMouseLeave={() =>
                  setHoveredTopicId((prev) => (prev === topic.id ? null : prev))
                }
                aria-current={isActive ? 'true' : undefined}
                title={`${topic.title} (${clampedMastery}% mastery)`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: COL_WIDTH,
                  height: NODE_HEIGHT,
                }}
                className={cn(
                  'group absolute flex cursor-pointer flex-col justify-between rounded-base border-2 border-black px-3 py-2 text-left text-black transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2',
                  cardStateClasses
                )}
              >
                {/* Top Status & Boss / Active Pill Row */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {isMastered ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-[#05E17A] text-black" />
                    ) : isInProgress ? (
                      <Sparkles
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 fill-[#FFDC58] text-black',
                          shouldAnimate && 'animate-pulse'
                        )}
                      />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5 shrink-0 text-black/75" />
                    )}

                    {isActive ? (
                      <span className="truncate rounded-[4px] border border-black bg-black px-1.5 py-0.5 font-heading text-[9px] font-extrabold uppercase tracking-wider text-[#FFDC58]">
                        ACTIVE IN ARENA
                      </span>
                    ) : (
                      <span className="truncate font-heading text-[10px] font-extrabold uppercase tracking-wider text-black/85">
                        {isMastered
                          ? 'Mastered'
                          : isInProgress
                            ? 'In Progress'
                            : 'Available'}
                      </span>
                    )}
                  </div>

                  {topic.isBossTopic ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border border-black bg-[#FFDC58] px-1.5 py-0.5 font-heading text-[9px] font-extrabold uppercase tracking-wider text-black shadow-[1px_1px_0px_0px_#000]">
                      <Crown className="h-2.5 w-2.5 text-black" />
                      BOSS
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-[3px] border border-black/40 bg-white/80 px-1 font-mono text-[10px] font-bold text-black">
                      ~{topic.estimatedHours}h
                    </span>
                  )}
                </div>

                {/* Topic Title */}
                <div className="line-clamp-2 font-heading text-xs font-bold leading-[15px] text-black">
                  {topic.title}
                </div>

                {/* Bottom Mastery Bar & Compact Counters */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-[3px] border border-black bg-white">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          progressFillClass,
                          clampedMastery > 0 &&
                            clampedMastery < 100 &&
                            'border-r border-black'
                        )}
                        style={{ width: `${clampedMastery}%` }}
                      />
                    </div>
                    <span className="w-7 text-right font-mono text-[10px] font-extrabold text-black">
                      {clampedMastery}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] font-bold text-black/80">
                    <span>
                      📚 {topic.completedResourceCount}/{topic.resourceCount}
                    </span>
                    <span>
                      ⚔️ {topic.solvedProblemCount}/{topic.problemCount}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-secondary-background px-5 py-2.5 text-[11px] font-heading font-bold text-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-[2px] border border-black bg-[#05E17A]" />
            <span>Mastered Flow</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-[2px] border border-black bg-[#88AAEE]" />
            <span>Active Frontier Flow</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-[2px] border border-black bg-[#FF9F43]" />
            <span>Boss Convergence</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-5 bg-[#18181B]" />
            <span className="text-muted-foreground">Upcoming Path</span>
          </span>
        </div>

        <span className="text-[11px] text-muted-foreground">
          Active node:{' '}
          <strong className="rounded-[4px] border border-black bg-[#FFDC58] px-1.5 py-0.5 text-black">
            {layout.nodeById.get(activeTopicId)?.topic.title ?? 'Selected Topic'}
          </strong>
        </span>
      </div>
    </section>
  );
};
