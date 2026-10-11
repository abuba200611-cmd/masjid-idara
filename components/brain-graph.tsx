"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { parseLinks } from "@/lib/brain";

type GraphNote = { slug: string; title: string; body: string };
type SimNode = { slug: string; title: string; x: number; y: number; vx: number; vy: number; degree: number };
type Edge = { a: number; b: number };

const WIDTH = 800;
const HEIGHT = 500;
const REPULSION = 2600; // تنافر بين كل زوج عقد — يفرد الخريطة
const SPRING = 0.05; // نابض على كل وصلة — يجمع المتصلين
const REST_LENGTH = 120;
const GRAVITY = 0.015; // جاذبية نحو المركز — تمنع التشتت
const DAMPING = 0.85;
const ALPHA_FLOOR = 0.03;

function simulate(nodes: SimNode[], edges: Edge[], alpha: number, dragIndex: number | null): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distSq = dx * dx + dy * dy;
      if (distSq < 1) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distSq = dx * dx + dy * dy || 1;
      }
      const dist = Math.sqrt(distSq);
      const force = (REPULSION / distSq) * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  for (const edge of edges) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - REST_LENGTH) * SPRING * alpha;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    node.vx += (WIDTH / 2 - node.x) * GRAVITY * alpha;
    node.vy += (HEIGHT / 2 - node.y) * GRAVITY * alpha;
    node.vx *= DAMPING;
    node.vy *= DAMPING;
    if (i === dragIndex) continue; // العقدة الممسوكة يحدّدها المؤشر لا القوى
    node.x = Math.min(WIDTH - 12, Math.max(12, node.x + node.vx));
    node.y = Math.min(HEIGHT - 12, Math.max(12, node.y + node.vy));
  }
}

/**
 * خريطة الدماغ — محاكاة قوى صغيرة مكتوبة يدوياً (بلا مكتبات رسوم):
 * عقدة لكل ملاحظة وخط لكل وصلة [[مزدوجة]] بين ملاحظات موجودة. حلقة
 * التحريك تكتب إحداثيات SVG مباشرة كل إطار (بلا إعادة رسم React)،
 * السحب يحرّك العقدة، والضغط يفتح الملاحظة.
 */
export function BrainGraph({ notes, onOpen }: { notes: GraphNote[]; onOpen: (slug: string) => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<{ nodes: SimNode[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const dragRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const kickRef = useRef<() => void>(() => undefined);
  const circleElsRef = useRef<(SVGCircleElement | null)[]>([]);
  const labelElsRef = useRef<(SVGTextElement | null)[]>([]);
  const edgeElsRef = useRef<(SVGLineElement | null)[]>([]);

  // بناء العقد والوصلات من المحتوى — نقطة بداية دائرية حول المركز
  const layout = useMemo(() => {
    const indexBySlug = new Map(notes.map((note, i) => [note.slug, i]));
    const degree = notes.map(() => 0);
    const edges: Edge[] = [];
    const seen = new Set<string>();
    notes.forEach((note, i) => {
      for (const target of parseLinks(note.body)) {
        const j = indexBySlug.get(target);
        if (j === undefined || j === i) continue;
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ a: i, b: j });
        degree[i] += 1;
        degree[j] += 1;
      }
    });

    const nodes = notes.map((note, i) => {
      const angle = (i / Math.max(notes.length, 1)) * Math.PI * 2;
      const radius = 60 + 150 * Math.sqrt((i + 1) / Math.max(notes.length, 1));
      return {
        slug: note.slug,
        title: note.title,
        x: WIDTH / 2 + Math.cos(angle) * radius,
        y: HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        degree: degree[i],
      };
    });
    return { nodes, edges };
  }, [notes]);

  /** كتابة إحداثيات المحاكاة في عناصر SVG مباشرة */
  function writePositions(): void {
    const { nodes, edges } = simRef.current;
    nodes.forEach((node, i) => {
      circleElsRef.current[i]?.setAttribute("cx", String(node.x));
      circleElsRef.current[i]?.setAttribute("cy", String(node.y));
      labelElsRef.current[i]?.setAttribute("x", String(node.x));
      labelElsRef.current[i]?.setAttribute("y", String(node.y + 24));
    });
    edges.forEach((edge, i) => {
      const line = edgeElsRef.current[i];
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      if (!line || !a || !b) return;
      line.setAttribute("x1", String(a.x));
      line.setAttribute("y1", String(a.y));
      line.setAttribute("x2", String(b.x));
      line.setAttribute("y2", String(b.y));
    });
  }

  // عند تغيّر الملاحظات: أعد بناء المحاكاة مع إبقاء مواضع العقد الباقية
  useLayoutEffect(() => {
    const previous = new Map(simRef.current.nodes.map((node) => [node.slug, node]));
    simRef.current = {
      nodes: layout.nodes.map((node) => {
        const prev = previous.get(node.slug);
        return { ...node, x: prev?.x ?? node.x, y: prev?.y ?? node.y, vx: prev?.vx ?? 0, vy: prev?.vy ?? 0 };
      }),
      edges: layout.edges,
    };
    circleElsRef.current = [];
    labelElsRef.current = [];
    edgeElsRef.current = [];
    writePositions();
    kickRef.current();
  }, [layout]);

  // حلقة المحاكاة — تهدأ وحدها (alpha يتناقص) وتُستأنف عند التغيير أو السحب
  useEffect(() => {
    let raf = 0;
    let alpha = 1;
    let running = true;

    const step = () => {
      simulate(simRef.current.nodes, simRef.current.edges, alpha, dragRef.current);
      writePositions();
      alpha = Math.max(alpha * 0.985, ALPHA_FLOOR);
      if (alpha > ALPHA_FLOOR || dragRef.current !== null) {
        raf = requestAnimationFrame(step);
      } else {
        running = false;
      }
    };

    kickRef.current = () => {
      if (running) return;
      running = true;
      alpha = 0.5;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      kickRef.current = () => undefined;
    };
  }, []);

  function toSvgPoint(event: React.PointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  if (notes.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full touch-none select-none rounded-2xl border border-border bg-surface"
      onPointerMove={(event) => {
        if (dragRef.current === null) return;
        const point = toSvgPoint(event);
        const node = simRef.current.nodes[dragRef.current];
        if (node) {
          node.x = point.x;
          node.y = point.y;
          node.vx = 0;
          node.vy = 0;
          movedRef.current = true;
        }
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
      }}
    >
      {layout.edges.map((edge, i) => {
        const a = layout.nodes[edge.a];
        const b = layout.nodes[edge.b];
        return (
          <line
            key={i}
            ref={(el) => {
              edgeElsRef.current[i] = el;
            }}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#b9d6d2"
            strokeWidth={1.2}
          />
        );
      })}
      {layout.nodes.map((node, i) => (
        <g
          key={node.slug}
          className="cursor-pointer"
          onPointerDown={(event) => {
            dragRef.current = i;
            movedRef.current = false;
            kickRef.current();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onClick={() => {
            if (!movedRef.current) onOpen(node.slug);
          }}
        >
          <circle
            ref={(el) => {
              circleElsRef.current[i] = el;
            }}
            cx={node.x}
            cy={node.y}
            r={6 + Math.min(node.degree * 1.5, 8)}
            fill="#0d9488"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          <text
            ref={(el) => {
              labelElsRef.current[i] = el;
            }}
            x={node.x}
            y={node.y + 24}
            textAnchor="middle"
            fontSize={12}
            fill="#134e4a"
          >
            {node.title.length > 22 ? `${node.title.slice(0, 22)}…` : node.title}
          </text>
        </g>
      ))}
    </svg>
  );
}
