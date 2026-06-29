import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  Arrow,
  Circle,
  Line,
  Rect,
  Shape,
  TextShape,
} from "../../types/shapes";

export type ToolType =
  | "pencil"
  | "eraser"
  | "rectangle"
  | "fill"
  | "circle"
  | "arrow"
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
  y2: number,
): number {
  const dx = x2 - x1,
    dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function getTextBounds(
  ctx: CanvasRenderingContext2D,
  s: TextShape,
): { x: number; y: number; w: number; h: number } {
  ctx.font = `${s.fontSize}px sans-serif`;
  const metrics = ctx.measureText(s.text || " ");
  return {
    x: s.x,
    y: s.y,
    w: Math.max(metrics.width, 20),
    h: s.fontSize * 1.4,
  };
}

type HandleName = "nw" | "ne" | "sw" | "se" | "start" | "end";
type HandleMap = Partial<Record<HandleName, { x: number; y: number }>>;

function getHandlePositions(
  ctx: CanvasRenderingContext2D | null,
  shape: Shape,
): HandleMap {
  if (shape.type === "rect") {
    const x = Math.min(shape.x, shape.x + shape.w);
    const y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w),
      h = Math.abs(shape.h);
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
    const w = Math.abs(shape.rX),
      h = Math.abs(shape.rY);
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

// ─── Text input state ────────────────────────────────────────────────────────
type TextInputState = {
  x: number;
  y: number;
  value: string;
  visible: boolean;
  editingIndex: number | null; // null = new text, number = editing existing shape
};

const CLOSED_TEXT: TextInputState = {
  x: 0,
  y: 0,
  value: "",
  visible: false,
  editingIndex: null,
};

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { color, brushSize, tool, backgroundColor, setBackgroundColor, fontSize },
  ref,
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

  const [textInput, setTextInput] = useState<TextInputState>(CLOSED_TEXT);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // Imperatively focus the text input whenever it becomes visible
  useEffect(() => {
    if (textInput) {
      requestAnimationFrame(() => textInputRef.current?.focus());
    }
  }, [textInput.visible, textInput.x, textInput.y]);

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
      setTextInput(CLOSED_TEXT);
      setBackgroundColor(bgColor);
      setShapes(newShapes);
    },
  }));

  // ── Init canvas context ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctxRef.current = ctx;
  }, []);

  // ── Rendering helpers ────────────────────────────────────────────────────
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    clr: string,
    size: number,
  ) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(14, size * 3);
    const ha = Math.PI / 6;
    ctx.strokeStyle = clr;
    ctx.fillStyle = clr;
    ctx.lineWidth = size;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - ha),
      y2 - headLen * Math.sin(angle - ha),
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + ha),
      y2 - headLen * Math.sin(angle + ha),
    );
    ctx.closePath();
    ctx.fill();
  };

  const drawShapeList = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    list: Shape[],
    bgColor: string,
  ) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    list.forEach((s) => {
      ctx.setLineDash([]);
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
        const cx = s.x + s.rX / 2,
          cy = s.y + s.rY / 2;
        const rx = Math.abs(s.rX) / 2,
          ry = Math.abs(s.rY) / 2;
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
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.stroke();
      }
    });
  };

  const drawSelectionOverlay = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
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
      ctx.strokeRect(
        x - 4,
        y - 4,
        Math.abs(shape.w) + 8,
        Math.abs(shape.h) + 8,
      );
    } else if (shape.type === "circle") {
      const x = Math.min(shape.x, shape.x + shape.rX);
      const y = Math.min(shape.y, shape.y + shape.rY);
      ctx.strokeRect(
        x - 4,
        y - 4,
        Math.abs(shape.rX) + 8,
        Math.abs(shape.rY) + 8,
      );
    } else if (shape.type === "text") {
      const b = getTextBounds(ctx, shape);
      ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    } else if (shape.type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
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
    });
  };

  const draw = (list: Shape[], selIdx: number | null) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    drawShapeList(ctx, canvas, list, backgroundColorRef.current);
    if (selIdx !== null && list[selIdx]) {
      drawSelectionOverlay(ctx, list[selIdx]);
    }
  };

  useEffect(() => {
    draw(shapes, selectedIndex);
  }, [shapes, selectedIndex, backgroundColor]);

  // ── History ──────────────────────────────────────────────────────────────
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
      if ((e.key === "Delete" || e.key === "Backspace") && !textInput.visible) {
        const idx = selectedIndexRef.current;
        if (idx !== null) {
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

  // ── Hit testing ──────────────────────────────────────────────────────────
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
        const cx = shape.x + shape.rX / 2,
          cy = shape.y + shape.rY / 2;
        const rx = Math.abs(shape.rX) / 2,
          ry = Math.abs(shape.rY) / 2;
        if (rx > 0 && ry > 0) {
          const n =
            Math.pow(x - cx, 2) / Math.pow(rx, 2) +
            Math.pow(y - cy, 2) / Math.pow(ry, 2);
          if (n <= 1) return i;
        }
      }
      if (shape.type === "arrow") {
        if (
          distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <=
          shape.brushSize + 8
        )
          return i;
      }
      if (shape.type === "text" && ctx) {
        const b = getTextBounds(ctx, shape);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
      }
    }
    return -1;
  };

  // ── Commit text input (shared by Enter and blur) ─────────────────────────
  const commitTextInput = (value: string, state: TextInputState) => {
    if (state.editingIndex !== null) {
      const updated = [...shapesRef.current];
      const existing = updated[state.editingIndex] as TextShape;
      if (value.trim()) {
        updated[state.editingIndex] = { ...existing, text: value };
        commit(updated);
      } else {
        // Empty text → delete the shape
        updated.splice(state.editingIndex, 1);
        commit(updated);
        setSelectedIndex(null);
      }
    } else {
      if (value.trim()) {
        const newText: TextShape = {
          type: "text",
          x: state.x,
          y: state.y,
          text: value,
          color,
          fontSize,
        };
        commit([...shapesRef.current, newText]);
      }
    }
  };

  // ── Mouse down ───────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // If a text input is open, commit it and close before handling new action
    if (textInput.visible) {
      commitTextInput(textInput.value, textInput);
      setTextInput(CLOSED_TEXT);
      return;
    }

    isDrawing.current = true;
    startPos.current = { x, y };

    const selIdx = selectedIndexRef.current;
    const ctx = ctxRef.current;

    // 1. Check resize handles on selected shape
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
            const oppPos = (
              handles as Record<string, { x: number; y: number } | undefined>
            )[opp];
            resizeAnchor.current = oppPos ?? pos;
          }
          isDragging.current = false;
          return;
        }
      }
    }

    // 2. Fill tool — bypasses implicit selection, works directly on shapes
    if (tool === "fill") {
      const updated = [...shapesRef.current];
      for (let i = updated.length - 1; i >= 0; i--) {
        const s = updated[i];
        if (s.type === "rect") {
          const minX = Math.min(s.x, s.x + s.w),
            maxX = Math.max(s.x, s.x + s.w);
          const minY = Math.min(s.y, s.y + s.h),
            maxY = Math.max(s.y, s.y + s.h);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            updated[i] = { ...s, fillColor: color };
            commit(updated);
            break;
          }
        }
        if (s.type === "circle") {
          const cx = s.x + s.rX / 2,
            cy = s.y + s.rY / 2;
          const rx = Math.abs(s.rX) / 2,
            ry = Math.abs(s.rY) / 2;
          if (rx > 0 && ry > 0) {
            const n =
              Math.pow(x - cx, 2) / Math.pow(rx, 2) +
              Math.pow(y - cy, 2) / Math.pow(ry, 2);
            if (n <= 1) {
              updated[i] = { ...s, fillColor: color };
              commit(updated);
              break;
            }
          }
        }
      }
      isDrawing.current = false;
      return;
    }

    // 3. Text tool — open input on empty space; allow dragging shapes otherwise
    if (tool === "text") {
      const hitIdx = getShapeAtPoint(x, y);
      if (hitIdx !== -1) {
        // Click on a shape with text tool: drag it (same as implicit selection)
        setSelectedIndex(hitIdx);
        const shape = shapesRef.current[hitIdx];
        isDragging.current = true;
        dragOffset.current =
          shape.type === "arrow"
            ? { x: x - shape.x1, y: y - shape.y1 }
            : {
                x: x - (shape as { x: number }).x,
                y: y - (shape as { y: number }).y,
              };
      } else {
        // Click on empty canvas: create new text
        setSelectedIndex(null);
        setTextInput({ x, y, value: "", visible: true, editingIndex: null });
        isDrawing.current = false;
      }
      return;
    }

    // 4. Implicit selection for all remaining tools (except pencil/eraser)
    if (tool !== "pencil" && tool !== "eraser") {
      const hitIdx = getShapeAtPoint(x, y);
      if (hitIdx !== -1) {
        setSelectedIndex(hitIdx);
        const shape = shapesRef.current[hitIdx];
        isDragging.current = true;
        isResizing.current = false;
        dragOffset.current =
          shape.type === "arrow"
            ? { x: x - shape.x1, y: y - shape.y1 }
            : {
                x: x - (shape as { x: number }).x,
                y: y - (shape as { y: number }).y,
              };
        return;
      } else {
        setSelectedIndex(null);
      }
    }

    // 5. Drawing tools
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

  // ── Double click → edit existing text ───────────────────────────────────
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    const hitIdx = getShapeAtPoint(x, y);
    if (hitIdx === -1) return;

    const shape = shapesRef.current[hitIdx];
    if (shape.type !== "text") return;

    // Open text input pre-filled with existing text
    setSelectedIndex(null);
    setTextInput({
      x: shape.x,
      y: shape.y,
      value: shape.text,
      visible: true,
      editingIndex: hitIdx,
    });
  };

  // ── Mouse move ───────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // Cursor feedback
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
      canvas.style.cursor = onHandle
        ? "crosshair"
        : tool === "pencil" || tool === "eraser" || tool === "fill"
          ? "crosshair"
          : "default";
    }

    if (!isDrawing.current) return;
    const start = startPos.current;

    // Resize
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
        shape.x = Math.min(x, anchor.x);
        shape.y = Math.min(y, anchor.y);
        shape.w = Math.abs(x - anchor.x);
        shape.h = Math.abs(y - anchor.y);
      } else if (shape.type === "circle") {
        shape.x = Math.min(x, anchor.x);
        shape.y = Math.min(y, anchor.y);
        shape.rX = Math.abs(x - anchor.x);
        shape.rY = Math.abs(y - anchor.y);
      } else if (shape.type === "text") {
        shape.fontSize = Math.max(8, Math.round(Math.abs(y - anchor.y) / 1.4));
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

    // Drag
    if (isDragging.current && selectedIndexRef.current !== null) {
      const idx = selectedIndexRef.current;
      const updated = [...shapesRef.current];
      const shape = { ...updated[idx] } as Shape;

      if (
        shape.type === "rect" ||
        shape.type === "circle" ||
        shape.type === "text"
      ) {
        shape.x = x - dragOffset.current.x;
        shape.y = y - dragOffset.current.y;
      } else if (shape.type === "arrow") {
        const newX1 = x - dragOffset.current.x;
        const newY1 = y - dragOffset.current.y;
        const dx = newX1 - shape.x1,
          dy = newY1 - shape.y1;
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
      ctx.setLineDash([]);
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
      const rX = x - start.x,
        rY = y - start.y;
      ctx.beginPath();
      ctx.ellipse(
        start.x + rX / 2,
        start.y + rY / 2,
        Math.abs(rX) / 2,
        Math.abs(rY) / 2,
        0,
        0,
        Math.PI * 2,
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

  // ── Mouse up ─────────────────────────────────────────────────────────────
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
      if (currentLine.current)
        commit([...shapesRef.current, currentLine.current]);
      currentLine.current = null;
      return;
    }

    if (!start) return;

    if (tool === "rectangle") {
      commit([
        ...shapesRef.current,
        {
          type: "rect",
          x: start.x,
          y: start.y,
          w: x - start.x,
          h: y - start.y,
          color,
          brushSize,
        } as Rect,
      ]);
    }
    if (tool === "circle") {
      commit([
        ...shapesRef.current,
        {
          type: "circle",
          x: start.x,
          y: start.y,
          rX: x - start.x,
          rY: y - start.y,
          color,
          brushSize,
        } as Circle,
      ]);
    }
    if (tool === "arrow") {
      commit([
        ...shapesRef.current,
        {
          type: "arrow",
          x1: start.x,
          y1: start.y,
          x2: x,
          y2: y,
          color,
          brushSize,
        } as Arrow,
      ]);
    }
  };

  const handleMouseLeave = () => {
    if (
      (isDragging.current || isResizing.current) &&
      !isDrawing.current === false
    ) {
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
    // Draw without selection overlay for clean export
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawShapeList(ctx, canvas, shapesRef.current, backgroundColorRef.current);
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    // Re-draw with selection
    draw(shapesRef.current, selectedIndexRef.current);
  };

  return (
    <div className="relative">
      {textInput.visible && (
        <input
          ref={textInputRef}
          className="absolute bg-transparent outline-none border border-dashed border-blue-500 px-0.5"
          value={textInput.value}
          onChange={(e) =>
            setTextInput((prev) => ({ ...prev, value: e.target.value }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTextInput(textInput.value, textInput);
              setTextInput(CLOSED_TEXT);
            }
            if (e.key === "Escape") {
              setTextInput(CLOSED_TEXT);
            }
          }}
          onBlur={() => {
            commitTextInput(textInput.value, textInput);
            setTextInput(CLOSED_TEXT);
          }}
          style={{
            left: textInput.x,
            top: textInput.y,
            fontSize: `${fontSize}px`,
            fontFamily: "sans-serif",
            color: color,
            minWidth: "4ch",
          }}
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
        onDoubleClick={handleDoubleClick}
        className="border border-gray-300 block"
        style={{ cursor: "default" }}
      />

      <div className="absolute top-2 right-2 flex gap-2">
        {clearConfirm ? (
          <div className="flex items-center gap-2 bg-white border border-red-300 rounded px-3 py-1 shadow-sm">
            <span className="text-sm text-red-600 font-medium">
              Clear all shapes?
            </span>
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
