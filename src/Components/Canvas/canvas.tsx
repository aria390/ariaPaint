import { useEffect, useRef, useState } from "react";

type CanvasProps = {
  color: string;
  brushSize: number;
  tool:
    | "pencil"
    | "eraser"
    | "rectangle"
    | "fill"
    | "circle"
    | "arrow"
    | "select"
    | "text";
  backgroundColor: string;
  fontSize: number;
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

type Circle = {
  type: "circle";
  x: number;
  y: number;
  rX: number;
  rY: number;
  color: string;
  fillColor?: string;
  brushSize: number;
};

type Arrow = {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  brushSize: number;
};

type TextShape = {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

type Shape = Rect | Line | Circle | Arrow | TextShape;

export default function canvas({
  color,
  brushSize,
  tool,
  backgroundColor,
  fontSize,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    value: string;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    value: "",
    visible: false,
  });

  // ✅ SINGLE SOURCE OF TRUTH
  const [shapes, setShapes] = useState<Shape[]>([]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const getShapeAtPoint = (x: number, y: number): number => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];

      if (s.type === "rect") {
        if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
          return i;
        }
      }

      if (s.type === "circle") {
        const cx = s.x + s.rX / 2;
        const cy = s.y + s.rY / 2;

        const rx = Math.abs(s.rX) / 2;
        const ry = Math.abs(s.rY) / 2;

        const normalized =
          Math.pow(x - cx, 2) / Math.pow(rx, 2) +
          Math.pow(y - cy, 2) / Math.pow(ry, 2);

        if (normalized <= 1) return i;
      }
    }

    return -1;
  };

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

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    list.forEach((s) => {
      if (s.type === "text") {
        ctx.textBaseline = "top";
        ctx.fillStyle = s.color;
        ctx.font = `${s.fontSize}px sans-serif`;
        ctx.fillText(s.text, s.x, s.y);
      }

      if (s.type === "arrow") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.brushSize;

        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }

      if (s.type === "circle") {
        if (s.fillColor) {
          ctx.fillStyle = s.fillColor;
          ctx.beginPath();
          ctx.ellipse(
            s.x + s.rX / 2,
            s.y + s.rY / 2,
            Math.abs(s.rX) / 2,
            Math.abs(s.rY) / 2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.brushSize;

        ctx.beginPath();
        ctx.ellipse(
          s.x + s.rX / 2,
          s.y + s.rY / 2,
          Math.abs(s.rX) / 2,
          Math.abs(s.rY) / 2,
          0,
          0,
          Math.PI * 2,
        );
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
        ctx.strokeStyle = s.isEraser ? backgroundColor : s.color;
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
  }, [shapes, backgroundColor]);

  // ======================
  // COMMIT
  // ======================
  const commit = (newShapes: Shape[]) => {
    historyRef.current.push([...shapes]);
    redoRef.current = [];

    setShapes(newShapes);
  };

  // ======================
  // UNDO
  // ======================
  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;

    redoRef.current.push([...shapes]);
    setShapes(prev);
  };

  // ======================
  // REDO
  // ======================
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;

    historyRef.current.push([...shapes]);
    setShapes(next);
  };

  // ======================
  // Dounload IMG
  // ======================
  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
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

    const findCircleAtPoint = (x: number, y: number) => {
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];

        if (s.type === "circle") {
          const cx = s.x + s.rX / 2;
          const cy = s.y + s.rY / 2;

          const rx = Math.abs(s.rX) / 2;
          const ry = Math.abs(s.rY) / 2;

          const normalized =
            Math.pow(x - cx, 2) / Math.pow(rx, 2) +
            Math.pow(y - cy, 2) / Math.pow(ry, 2);

          if (normalized <= 1) return i;
        }
      }
      return -1;
    };

    if (tool === "text") {
      setTextInput({
        x,
        y,
        value: "",
        visible: true,
      });
      return;
    }

    if (tool === "fill") {
      const index = findCircleAtPoint(x, y);
      const rectIndex = findRectAtPoint(x, y);

      const updated = [...shapes];

      if (index !== -1 && updated[index].type === "circle") {
        updated[index] = {
          ...updated[index],
          fillColor: color,
        };
        commit(updated);
        isDrawing.current = false;
        return;
      }

      if (rectIndex !== -1 && updated[rectIndex].type === "rect") {
        updated[rectIndex] = {
          ...updated[rectIndex],
          fillColor: color,
        };
        commit(updated);
        isDrawing.current = false;
        return;
      }

      isDrawing.current = false;
      return;
    }
    if (tool === "select") {
      const index = getShapeAtPoint(x, y);

      if (index !== -1) {
        setSelectedIndex(index);
        isDragging.current = true;

        const shape = shapes[index];

        if (shape.type === "rect") {
          if (isDragging.current && selectedIndex !== null) {
            const x = e.nativeEvent.offsetX;
            const y = e.nativeEvent.offsetY;

            const updated = [...shapes];
            const shape = updated[selectedIndex];

            if (shape.type === "rect") {
              shape.x = x - dragOffset.current.x;
              shape.y = y - dragOffset.current.y;
            }

            if (shape.type === "circle") {
              shape.x = x - dragOffset.current.x;
              shape.y = y - dragOffset.current.y;
            }

            if (shape.type === "arrow") {
              const dx = x - dragOffset.current.x;
              const dy = y - dragOffset.current.y;

              const offsetX = dx - shape.x1;
              const offsetY = dy - shape.y1;

              shape.x1 += offsetX;
              shape.y1 += offsetY;
              shape.x2 += offsetX;
              shape.y2 += offsetY;
            }

            if (shape.type === "text") {
              shape.x = x - dragOffset.current.x;
              shape.y = y - dragOffset.current.y;
            }

            setShapes(updated);
            return;
          }
        }

        if (shape.type === "circle") {
          dragOffset.current = {
            x: x - shape.x,
            y: y - shape.y,
          };
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

  // ======================
  // MOUSE MOVE
  // ======================
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    const start = startPos.current;
    if (!start) return;

    if (isDragging.current && selectedIndex !== null) {
      const x = e.nativeEvent.offsetX;
      const y = e.nativeEvent.offsetY;

      const updated = [...shapes];
      const shape = updated[selectedIndex];

      if (shape.type === "rect") {
        shape.x = x - dragOffset.current.x;
        shape.y = y - dragOffset.current.y;
      }

      if (shape.type === "circle") {
        shape.x = x - dragOffset.current.x;
        shape.y = y - dragOffset.current.y;
      }

      setShapes(updated);
      return;
    }

    if (tool === "pencil" || tool === "eraser") {
      const line = currentLine.current;
      if (!line) return;

      const last = line.points[line.points.length - 1];

      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.strokeStyle = line.isEraser ? backgroundColor : line.color;
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
    if (tool === "circle") {
      draw(shapes);

      const ctx = ctxRef.current;
      if (!ctx) return;

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
        Math.PI * 2,
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    }

    if (tool === "arrow") {
      draw(shapes);

      const ctx = ctxRef.current;
      if (!ctx || !start) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(x, y);
      ctx.stroke();
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

    if (tool === "select") {
      isDragging.current = false;
      return;
    }

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

    if (tool === "circle" && start) {
      const rX = x - start.x;
      const rY = y - start.y;

      const circle: Circle = {
        type: "circle",
        x: start.x,
        y: start.y,
        rX,
        rY,
        color,
        brushSize,
      };

      commit([...shapes, circle]);
    }

    if (tool === "arrow" && start) {
      const arrow: Arrow = {
        type: "arrow",
        x1: start.x,
        y1: start.y,
        x2: x,
        y2: y,
        color,
        brushSize,
      };

      commit([...shapes, arrow]);
    }
  };

  return (
    <div className="relative">
      {textInput.visible && (
        <input
          className="absolute border border-solid border-black bg-white"
          autoFocus
          value={textInput.value}
          onChange={(e) =>
            setTextInput((prev) => ({
              ...prev,
              value: e.target.value,
            }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const newText: TextShape = {
                type: "text",
                x: textInput.x,
                y: textInput.y,
                text: textInput.value,
                color,
                fontSize,
              };

              setShapes((prev) => [...prev, newText]);

              setTextInput({
                x: 0,
                y: 0,
                value: "",
                visible: false,
              });
            }
          }}
          style={{
            left: textInput.x,
            top: textInput.y,
            fontSize: fontSize,
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={1400}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="border border-gray-300"
      />
      <button
        onClick={downloadImage}
        className="absolute cursor-pointer top-2 right-2 px-3 py-1 bg-black text-white rounded"
      >
        Download
      </button>
    </div>
  );
}
