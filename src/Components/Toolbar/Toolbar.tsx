type ToolbarProps = {
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;

  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;

  tool: "pencil" | "eraser" | "rectangle" | "fill";
  setTool: React.Dispatch<
    React.SetStateAction<"pencil" | "eraser" | "rectangle" | "fill">
  >;
};

export default function Toolbar({
  color,
  setColor,
  brushSize,
  setBrushSize,
  tool,
  setTool,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg w-fit">
      {/* COLORS */}
      <div className="flex items-center gap-2">
        <span>Color:</span>
        <input
          className="size-8"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>

      {/* SIZE */}
      <div className="flex items-center gap-2">
        <span>Size:</span>
        <input
          type="range"
          min={1}
          max={50}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
        <span>{brushSize}px</span>
      </div>

      {/* TOOLS */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTool("pencil")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "pencil" ? "bg-black text-white" : ""
          }`}
        >
          Pencil
        </button>

        <button
          onClick={() => setTool("eraser")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "eraser" ? "bg-black text-white" : ""
          }`}
        >
          Eraser
        </button>

        <button
          onClick={() => setTool("rectangle")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "rectangle" ? "bg-black text-white" : ""
          }`}
        >
          Rectangle
        </button>

        <button
          onClick={() => setTool("fill")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "fill" ? "bg-black text-white" : ""
          }`}
        >
          Fill
        </button>
      </div>
    </div>
  );
}
