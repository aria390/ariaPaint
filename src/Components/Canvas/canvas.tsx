import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Arrow, Circle, Line, Rect, Shape, TextShape } from "../../types/shapes";

export type ToolType =
  | "pencil"
  | "eraser"
  | "rectangle"
  | "fill"
  | "circle"
  | "arrow"
  | "select"
  | "text";

type CanvasProps = {
  color: string;
  brushSize: number;
  tool: ToolType;
  backgroundColor: string;
  setBackgroundColor: (c: string) => void;
  fontSize: number;
};

export interface CanvasHandle {
  getShapes: () => Shape[];
  getBackgroundColor: () => string;
  loadProject: (shapes: Shape[], bgColor: string) => void;
}

const HANDLE_R = 6;

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function getTextBounds(
  ctx: CanvasRenderingContext2D,
  s: TextShape
): { x: number; y: number; w: number; h: number } {
  ctx.font = `${s.fontSize}px sans-serif`;
  const metrics = ctx.measureText(s.text || " ");
  return { x: s.x, y: s.y, w: metrics.width, h: s.fontSize * 1.2 };
}

type HandleName = "nw" | "ne" | "sw" | "se" | "start" | "end";
type HandleMap = Partial<Record<HandleName, { x: number; y: number }>>;

function getHandlePositions(
  ctx: CanvasRenderingContext2D | null,
  shape: Shape
): HandleMap {
  if (shape.type === "rect") {
    const x = Math.min(shape.x, shape.x + shape.w);
    const y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w);
    const h = Math.abs(shape.h);
    return {
      nw: { x, y },
      ne: { x: x + w, y },
      sw: { x, y: y + h },
      se: { x: x + w, y: y + h },
    };
  }
  if (shape.type === "circle") {
    const x = Math.min(shape.x, shape.x + shape.rX);
    const y = Math.min(shape.y, shape.y + shape.rY);
    const w = Math.abs(shape.rX);
    const h = Math.abs(shape.rY);
    return {
      nw: { x, y },
      ne: { x: x + w, y },
      sw: { x, y: y + h },
      se: { x: x + w, y: y + h },
    };
  }
  if (shape.type === "text" && ctx) {
    const b = getTextBounds(ctx, shape);
    return {
      nw: { x: b.x, y: b.y },
      ne: { x: b.x + b.w, y: b.y },
      sw: { x: b.x, y: b.y + b.h },
      se: { x: b.x + b.w, y: b.y + b.h },
    };
  }
  if (shape.type === "arrow") {
    return {
      start: { x: shape.x1, y: shape.y1 },
      end: { x: shape.x2, y: shape.y2 },
    };
  }
  return {};
}

const oppositeHandle: Record<string, string> = {
  nw: "se",
  ne: "sw",
  sw: "ne",
  se: "nw",
};

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { color, brushSize, tool, backgroundColor, setBackgroundColor, fontSize },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    value: string;
    visible: boolean;
  }>({ x: 0, y: 0, value: "", visible: false });

  const [clearConfirm, setClearConfirm] = useState(false);

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isResizing = useRef(false);
  const resizingHandle = useRef<string | null>(null);
  const resizeAnchor = useRef<{ x: number; y: number } | null>(null);

  const isDrawing = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const currentLine = useRef<Line | null>(null);

  const historyRef = useRef<Shape[][]>([]);
  const redoRef = useRef<Shape[][]>([]);

  const backgroundColorRef = useRef(backgroundColor);
  useEffect(() => {
    backgroundColorRef.current = backgroundColor;
  }, [backgroundColor]);

  useImperativeHandle(ref, () => ({
    getShapes: () => shapesRef.current,
    getBackgroundColor: () => backgroundColorRef.current,
    loadProject: (newShapes, bgColor) => {
      historyRef.current = [];
      redoRef.current = [];
      setSelectedIndex(null);
      setBackgroundColor(bgColor);
      setShapes(newShapes);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctxRef.current = ctx;
  }, []);

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    size: number
  ) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(14, size * 3);
    const headAngle = Math.PI / 6;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - headAngle),
      y2 - headLen * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + headAngle),
      y2 - headLen * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
  };

  const drawShapeList = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    list: Shape[],
    bgColor: string
  ) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    list.forEach((s) => {
      if (s.type === "text") {
        ctx.textBaseline = "top";
        ctx.fillStyle = s.color;
        ctx.font = `${s.fontSize}px sans-serif`;
        ctx.fillText(s.text, s.x, s.y);
      }

      if (s.type === "arrow") {
        drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.color, s.brushSize);
      }

      if (s.type === "circle") {
        const cx = s.x + s.rX / 2;
        const cy = s.y + s.rY / 2;
        const rx = Math.abs(s.rX) / 2;
        const ry = Math.abs(s.rY) / 2;
        if (rx === 0 || ry === 0) return;

        if (s.fillColor) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = s.fillColor;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.brushSize;
        ctx.stroke();
      }

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
        ctx.strokeStyle = s.isEraser ? bgColor : s.color;
        ctx.lineWidth = s.brushSize;
        ctx.beginPath();
        s.points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        );
        ctx.stroke();
      }
    });
  };

  const drawSelectionOverlay = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    bgColor: string
  ) => {
    const handles = getHandlePositions(ctx, shape);
    const positions = Object.values(handles).filter(Boolean) as {
      x: number;
      y: number;
    }[];

    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;

    if (shape.type === "rect") {
      const x = Math.min(shape.x, shape.x + shape.w);
      const y = Math.min(shape.y, shape.y + shape.h);
      ctx.strokeRect(x - 4, y - 4, Math.abs(shape.w) + 8, Math.abs(shape.h) + 8);
    } else if (shape.type === "circle") {
      const x = Math.min(shape.x, shape.x + shape.rX);
      const y = Math.min(shape.y, shape.y + shape.rY);
      ctx.strokeRect(x - 4, y - 4, Math.abs(shape.rX) + 8, Math.abs(shape.rY) + 8);
    } else if (shape.type === "text") {
      const b = getTextBounds(ctx, shape);
      ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    } else if (shape.type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
    ctx.setLineDash([]);

    positions.forEach((pos) => {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.stroke();
      void bgColor;
    });
  };

  const draw = (list: Shape[], selIdx: number | null) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    drawShapeList(ctx, canvas, list, backgroundColorRef.current);

    if (selIdx !== null && list[selIdx]) {
      drawSelectionOverlay(ctx, list[selIdx], backgroundColorRef.current);
    }
  };

  useEffect(() => {
    draw(shapes, selectedIndex);
  }, [shapes, selectedIndex, backgroundColor]);

  const commit = (newShapes: Shape[]) => {
    historyRef.current.push([...shapesRef.current]);
    redoRef.current = [];
    setShapes(newShapes);
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push([...shapesRef.current]);
    setSelectedIndex(null);
    setShapes(prev);
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push([...shapesRef.current]);
    setSelectedIndex(null);
    setShapes(next);
  };

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
      if (e.key === "Escape") {
        setSelectedIndex(null);
        setClearConfirm(false);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const idx = selectedIndexRef.current;
        if (idx !== null && !textInput.visible) {
          const updated = [...shapesRef.current];
          updated.splice(idx, 1);
          commit(updated);
          setSelectedIndex(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput.visible]);

  const getShapeAtPoint = (x: number, y: number): number => {
    const s = shapesRef.current;
    const ctx = ctxRef.current;
    for (let i = s.length - 1; i >= 0; i--) {
      const shape = s[i];

      if (shape.type === "rect") {
        const minX = Math.min(shape.x, shape.x + shape.w);
        const maxX = Math.max(shape.x, shape.x + shape.w);
        const minY = Math.min(shape.y, shape.y + shape.h);
        const maxY = Math.max(shape.y, shape.y + shape.h);
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return i;
      }

      if (shape.type === "circle") {
        const cx = shape.x + shape.rX / 2;
        const cy = shape.y + shape.rY / 2;
        const rx = Math.abs(shape.rX) / 2;
        const ry = Math.abs(shape.rY) / 2;
        if (rx > 0 && ry > 0) {
          const n =
            Math.pow(x - cx, 2) / Math.pow(rx, 2) +
            Math.pow(y - cy, 2) / Math.pow(ry, 2);
          if (n <= 1) return i;
        }
      }

      if (shape.type === "arrow") {
        const d = distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2);
        if (d <= shape.brushSize + 8) return i;
      }

      if (shape.type === "text" && ctx) {
        const b = getTextBounds(ctx, shape);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
          return i;
      }
    }
    return -1;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    if (textInput.visible) return;

    isDrawing.current = true;
    startPos.current = { x, y };

    const selIdx = selectedIndexRef.current;
    const ctx = ctxRef.current;

    // 1. Check resize handles of currently selected shape first
    if (selIdx !== null && shapesRef.current[selIdx]) {
      const shape = shapesRef.current[selIdx];
      const handles = getHandlePositions(ctx, shape);

      for (const [handleName, pos] of Object.entries(handles)) {
        if (pos && Math.hypot(x - pos.x, y - pos.y) <= HANDLE_R + 4) {
          isResizing.current = true;
          resizingHandle.current = handleName;

          if (shape.type === "arrow") {
            resizeAnchor.current =
              handleName === "start"
                ? { x: shape.x2, y: shape.y2 }
                : { x: shape.x1, y: shape.y1 };
          } else {
            const opp = oppositeHandle[handleName];
            const oppPos = (handles as Record<string, { x: number; y: number } | undefined>)[opp];
            resizeAnchor.current = oppPos ?? pos;
          }

          isDragging.current = false;
          return;
        }
      }
    }

    // 2. Implicit selection — skip for pencil and eraser
    if (tool !== "pencil" && tool !== "eraser") {
      const hitIdx = getShapeAtPoint(x, y);

      if (hitIdx !== -1) {
        setSelectedIndex(hitIdx);
        const shape = shapesRef.current[hitIdx];
        isDragging.current = true;
        isResizing.current = false;

        if (shape.type === "arrow") {
          dragOffset.current = { x: x - shape.x1, y: y - shape.y1 };
        } else if (
          shape.type === "rect" ||
          shape.type === "circle" ||
          shape.type === "text"
        ) {
          dragOffset.current = { x: x - shape.x, y: y - shape.y };
        }
        return;
      } else {
        setSelectedIndex(null);
      }
    }

    // 3. Tool-specific drawing
    if (tool === "text") {
      setTextInput({ x, y, value: "", visible: true });
      isDrawing.current = false;
      return;
    }

    if (tool === "fill") {
      const updated = [...shapesRef.current];
      let filled = false;
      for (let i = updated.length - 1; i >= 0; i--) {
        const s = updated[i];
        if (s.type === "rect") {
          const minX = Math.min(s.x, s.x + s.w);
          const maxX = Math.max(s.x, s.x + s.w);
          const minY = Math.min(s.y, s.y + s.h);
          const maxY = Math.max(s.y, s.y + s.h);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            updated[i] = { ...s, fillColor: color };
            filled = true;
            break;
          }
        }
        if (s.type === "circle") {
          const cx = s.x + s.rX / 2;
          const cy = s.y + s.rY / 2;
          const rx = Math.abs(s.rX) / 2;
          const ry = Math.abs(s.rY) / 2;
          if (rx > 0 && ry > 0) {
            const n =
              Math.pow(x - cx, 2) / Math.pow(rx, 2) +
              Math.pow(y - cy, 2) / Math.pow(ry, 2);
            if (n <= 1) {
              updated[i] = { ...s, fillColor: color };
              filled = true;
              break;
            }
          }
        }
      }
      if (filled) commit(updated);
      isDrawing.current = false;
      return;
    }

    if (tool === "select") {
      const hitIdx = getShapeAtPoint(x, y);
      if (hitIdx !== -1) {
        setSelectedIndex(hitIdx);
        const shape = shapesRef.current[hitIdx];
        isDragging.current = true;
        if (shape.type === "arrow") {
          dragOffset.current = { x: x - shape.x1, y: y - shape.y1 };
        } else if (
          shape.type === "rect" ||
          shape.type === "circle" ||
          shape.type === "text"
        ) {
          dragOffset.current = { x: x - shape.x, y: y - shape.y };
        }
      } else {
        setSelectedIndex(null);
      }
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // Update cursor style
    const canvas = canvasRef.current;
    if (canvas) {
      const selIdx = selectedIndexRef.current;
      const ctx = ctxRef.current;
      let onHandle = false;
      if (selIdx !== null && shapesRef.current[selIdx]) {
        const handles = getHandlePositions(ctx, shapesRef.current[selIdx]);
        for (const [, pos] of Object.entries(handles)) {
          if (pos && Math.hypot(x - pos.x, y - pos.y) <= HANDLE_R + 4) {
            onHandle = true;
            break;
          }
        }
      }
      if (onHandle) canvas.style.cursor = "crosshair";
      else if (tool === "pencil" || tool === "eraser") canvas.style.cursor = "crosshair";
      else canvas.style.cursor = "default";
    }

    if (!isDrawing.current) return;
    const start = startPos.current;

    // Resize mode
    if (
      isResizing.current &&
      selectedIndexRef.current !== null &&
      resizingHandle.current &&
      resizeAnchor.current
    ) {
      const idx = selectedIndexRef.current;
      const updated = [...shapesRef.current];
      const shape = { ...updated[idx] } as Shape;
      const anchor = resizeAnchor.current;
      const handle = resizingHandle.current;

      if (shape.type === "rect") {
        const newX = Math.min(x, anchor.x);
        const newY = Math.min(y, anchor.y);
        shape.x = newX;
        shape.y = newY;
        shape.w = Math.abs(x - anchor.x);
        shape.h = Math.abs(y - anchor.y);
      } else if (shape.type === "circle") {
        shape.x = Math.min(x, anchor.x);
        shape.y = Math.min(y, anchor.y);
        shape.rX = Math.abs(x - anchor.x);
        shape.rY = Math.abs(y - anchor.y);
      } else if (shape.type === "text") {
        const newH = Math.abs(y - anchor.y);
        shape.fontSize = Math.max(8, Math.round(newH / 1.2));
        if (handle === "nw" || handle === "sw") shape.x = x;
        if (handle === "nw" || handle === "ne") shape.y = y;
      } else if (shape.type === "arrow") {
        if (handle === "start") {
          shape.x1 = x;
          shape.y1 = y;
        } else {
          shape.x2 = x;
          shape.y2 = y;
        }
      }

      updated[idx] = shape;
      setShapes(updated);
      return;
    }

    // Drag mode
    if (isDragging.current && selectedIndexRef.current !== null) {
      const idx = selectedIndexRef.current;
      const updated = [...shapesRef.current];
      const shape = { ...updated[idx] } as Shape;

      if (shape.type === "rect" || shape.type === "circle" || shape.type === "text") {
        shape.x = x - dragOffset.current.x;
        shape.y = y - dragOffset.current.y;
      } else if (shape.type === "arrow") {
        const newX1 = x - dragOffset.current.x;
        const newY1 = y - dragOffset.current.y;
        const dx = newX1 - shape.x1;
        const dy = newY1 - shape.y1;
        shape.x1 = newX1;
        shape.y1 = newY1;
        shape.x2 += dx;
        shape.y2 += dy;
      }

      updated[idx] = shape;
      setShapes(updated);
      return;
    }

    if (!start) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    if (tool === "pencil" || tool === "eraser") {
      const line = currentLine.current;
      if (!line) return;
      const last = line.points[line.points.length - 1];

      ctx.strokeStyle = line.isEraser ? backgroundColorRef.current : line.color;
      ctx.lineWidth = line.brushSize;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      line.points.push({ x, y });
      return;
    }

    if (tool === "rectangle") {
      draw(shapesRef.current, selectedIndexRef.current);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.setLineDash([]);
      ctx.strokeRect(start.x, start.y, x - start.x, y - start.y);
    }

    if (tool === "circle") {
      draw(shapesRef.current, selectedIndexRef.current);
      const rX = x - start.x;
      const rY = y - start.y;
      ctx.beginPath();
      ctx.ellipse(
        start.x + rX / 2,
        start.y + rY / 2,
        Math.abs(rX) / 2,
        Math.abs(rY) / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    if (tool === "arrow") {
      draw(shapesRef.current, selectedIndexRef.current);
      drawArrow(ctx, start.x, start.y, x, y, color, brushSize);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    const start = startPos.current;

    if (isResizing.current) {
      isResizing.current = false;
      resizingHandle.current = null;
      resizeAnchor.current = null;
      commit([...shapesRef.current]);
      return;
    }

    if (isDragging.current) {
      isDragging.current = false;
      commit([...shapesRef.current]);
      return;
    }

    startPos.current = null;

    if (tool === "pencil" || tool === "eraser") {
      if (currentLine.current) {
        commit([...shapesRef.current, currentLine.current]);
      }
      currentLine.current = null;
      return;
    }

    if (!start) return;

    if (tool === "rectangle") {
      const rect: Rect = {
        type: "rect",
        x: start.x,
        y: start.y,
        w: x - start.x,
        h: y - start.y,
        color,
        brushSize,
      };
      commit([...shapesRef.current, rect]);
    }

    if (tool === "circle") {
      const circle: Circle = {
        type: "circle",
        x: start.x,
        y: start.y,
        rX: x - start.x,
        rY: y - start.y,
        color,
        brushSize,
      };
      commit([...shapesRef.current, circle]);
    }

    if (tool === "arrow") {
      const arrow: Arrow = {
        type: "arrow",
        x1: start.x,
        y1: start.y,
        x2: x,
        y2: y,
        color,
        brushSize,
      };
      commit([...shapesRef.current, arrow]);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging.current || isResizing.current) {
      isDragging.current = false;
      isResizing.current = false;
      commit([...shapesRef.current]);
    }
    if (isDrawing.current && (tool === "pencil" || tool === "eraser")) {
      if (currentLine.current) {
        commit([...shapesRef.current, currentLine.current]);
        currentLine.current = null;
      }
    }
    isDrawing.current = false;
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="relative">
      {textInput.visible && (
        <input
          className="absolute border border-dashed border-blue-400 bg-transparent outline-none"
          autoFocus
          value={textInput.value}
          onChange={(e) =>
            setTextInput((prev) => ({ ...prev, value: e.target.value }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (textInput.value.trim()) {
                const newText: TextShape = {
                  type: "text",
                  x: textInput.x,
                  y: textInput.y,
                  text: textInput.value,
                  color,
                  fontSize,
                };
                commit([...shapesRef.current, newText]);
              }
              setTextInput({ x: 0, y: 0, value: "", visible: false });
            }
            if (e.key === "Escape") {
              setTextInput({ x: 0, y: 0, value: "", visible: false });
            }
          }}
          onBlur={() =>
            setTextInput({ x: 0, y: 0, value: "", visible: false })
          }
          style={{ left: textInput.x, top: textInput.y, fontSize }}
        />
      )}

      <canvas
        ref={canvasRef}
        width={1280}
        height={680}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="border border-gray-300 block"
        style={{ cursor: "default" }}
      />

      <div className="absolute top-2 right-2 flex gap-2">
        {clearConfirm ? (
          <div className="flex items-center gap-2 bg-white border border-red-300 rounded px-3 py-1 shadow-sm">
            <span className="text-sm text-red-600 font-medium">Clear all shapes?</span>
            <button
              onClick={() => {
                commit([]);
                setSelectedIndex(null);
                setClearConfirm(false);
              }}
              className="px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            >
              Yes, clear
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setClearConfirm(true)}
            className="cursor-pointer px-3 py-1 bg-white border border-gray-300 text-gray-700 text-sm rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        )}
        <button
          onClick={downloadImage}
          className="cursor-pointer px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800"
        >
          Download
        </button>
      </div>
    </div>
  );
});

export default Canvas;
