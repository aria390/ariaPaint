import { useEffect, useRef, useState } from "react";

type CanvasProps = {
  color: string;
  brushSize: number;
  tool: "pencil" | "eraser" | "rectangle" | "fill";
};

// ======================
type Rect = {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fillColor?: string;
  brushSize: number;
};

type Line = {
  type: "line";
  points: { x: number; y: number }[];
  color: string;
  brushSize: number;
  isEraser: boolean;
};

type Shape = Rect | Line;

export default function canvas({ color, brushSize, tool }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // ✅ SINGLE SOURCE OF TRUTH
  const [shapes, setShapes] = useState<Shape[]>([]);

  const historyRef = useRef<Shape[][]>([]);
  const redoRef = useRef<Shape[][]>([]);

  const currentLine = useRef<Line | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);

  // ======================
  // INIT
  // ======================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctxRef.current = ctx;
  }, []);

  // ======================
  // DRAW
  // ======================
  const draw = (list: Shape[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    list.forEach((s) => {
      if (s.type === "rect") {
        if (s.fillColor) {
          ctx.fillStyle = s.fillColor;
          ctx.fillRect(s.x, s.y, s.w, s.h);
        }

        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.brushSize;
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      }

      if (s.type === "line") {
        ctx.strokeStyle = s.isEraser ? "#fff" : s.color;
        ctx.lineWidth = s.brushSize;

        ctx.beginPath();
        s.points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.stroke();
      }
    });
  };

  // ======================
  // SYNC DRAW
  // ======================
  useEffect(() => {
    draw(shapes);
  }, [shapes]);

  // ======================
  // COMMIT
  // ======================
  const commit = (newShapes: Shape[]) => {
    historyRef.current.push(shapes);
    redoRef.current = [];

    setShapes(newShapes);
  };

  // ======================
  // UNDO
  // ======================
  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;

    redoRef.current.push(shapes);
    setShapes(prev);
  };

  // ======================
  // REDO
  // ======================
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;

    historyRef.current.push(shapes);
    setShapes(next);
  };

  // ======================
  // KEYBOARD (THIS WAS MISSING)
  // ======================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }

      if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shapes]);

  //fillcolor_partOf
  const findRectAtPoint = (x: number, y: number) => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];

      if (
        shape.type === "rect" &&
        x >= Math.min(shape.x, shape.x + shape.w) &&
        x <= Math.max(shape.x, shape.x + shape.w) &&
        y >= Math.min(shape.y, shape.y + shape.h) &&
        y <= Math.max(shape.y, shape.y + shape.h)
      ) {
        return i;
      }
    }

    return -1;
  };

  // ======================
  // MOUSE DOWN
  // ======================
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    isDrawing.current = true;
    startPos.current = { x, y };

    if (tool === "fill") {
      const index = findRectAtPoint(x, y);

      if (index !== -1) {
        const updated = [...shapes];

        const rect = updated[index];

        if (rect.type === "rect") {
          updated[index] = {
            ...rect,
            fillColor: color,
          };

          commit(updated);
        }
      }

      isDrawing.current = false;
      return;
    }

    if (tool === "pencil" || tool === "eraser") {
      currentLine.current = {
        type: "line",
        points: [{ x, y }],
        color,
        brushSize,
        isEraser: tool === "eraser",
      };
    }
  };

  // ======================
  // MOUSE MOVE
  // ======================
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    const start = startPos.current;
    if (!start) return;

    if (tool === "pencil" || tool === "eraser") {
      const line = currentLine.current;
      if (!line) return;

      const last = line.points[line.points.length - 1];

      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.strokeStyle = line.isEraser ? "#fff" : line.color;
      ctx.lineWidth = line.brushSize;

      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      line.points.push({ x, y });
    }

    if (tool === "rectangle") {
      draw(shapes);

      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;

      ctx.strokeRect(start.x, start.y, x - start.x, y - start.y);
    }
  };

  // ======================
  // MOUSE UP
  // ======================
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    isDrawing.current = false;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    const start = startPos.current;

    if (tool === "pencil" || tool === "eraser") {
      if (currentLine.current) {
        commit([...shapes, currentLine.current]);
      }
      currentLine.current = null;
    }

    if (tool === "rectangle" && start) {
      const rect: Rect = {
        type: "rect",
        x: start.x,
        y: start.y,
        w: x - start.x,
        h: y - start.y,
        color,
        fillColor: undefined,
        brushSize,
      };

      commit([...shapes, rect]);
    }

    startPos.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={1400}
      height={600}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="border border-gray-300"
    />
  );
}
