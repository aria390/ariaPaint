import { useEffect, useRef } from "react";

type CanvasProps = {
  color: string;
  brushSize: number;
  tool: "pencil" | "eraser";
};

export default function canvas({ color, brushSize, tool }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
  }, []);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    isDrawing.current = true;

    // 🎯 تعیین رنگ ابزار
    if (tool === "eraser") {
      ctx.strokeStyle = "#ffffff"; // پاک‌کن
    } else {
      ctx.strokeStyle = color; // قلم
    }

    // 🎯 ضخامت قلم
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";

    // 🎯 شروع مسیر جدید
    ctx.beginPath();

    ctx.moveTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.lineTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);

    ctx.stroke();
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
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
