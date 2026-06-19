type ToolbarProps = {
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;

  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;

  tool:
    | "pencil"
    | "eraser"
    | "rectangle"
    | "fill"
    | "circle"
    | "arrow"
    | "select"
    | "text";
  setTool: React.Dispatch<
    React.SetStateAction<
      | "pencil"
      | "eraser"
      | "rectangle"
      | "fill"
      | "circle"
      | "arrow"
      | "text"
      | "select"
    >
  >;

  backgroundColor: string;
  setBackgroundColor: React.Dispatch<React.SetStateAction<string>>;

  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
};

export default function Toolbar({
  color,
  setColor,
  brushSize,
  setBrushSize,
  tool,
  setTool,
  backgroundColor,
  setBackgroundColor,
  fontSize,
  setFontSize,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg w-fit">
      {/* COLORS */}
      <section className="flex justify-between relative">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>Color:</span>
            <input
              className="size-8"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Background:</span>

            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="size-8"
            />
          </div>
        </div>
        <img
          className="size-30 absolute left-118 -top-4"
          src="/AriaPaint.jpg"
          alt=""
        />
      </section>

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

      <div className="flex items-center gap-2">
        <span>Text Size:</span>

        <input
          type="range"
          min={10}
          max={80}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
        />

        <span>{fontSize}px</span>
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
          onClick={() => setTool("circle")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "circle" ? "bg-black text-white" : ""
          }`}
        >
          Circle
        </button>

        <button
          onClick={() => setTool("arrow")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "arrow" ? "bg-black text-white" : ""
          }`}
        >
          Arrow
        </button>

        <button
          onClick={() => setTool("fill")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "fill" ? "bg-black text-white" : ""
          }`}
        >
          Fill
        </button>
        <button
          onClick={() => setTool("text")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "text" ? "bg-black text-white" : ""
          }`}
        >
          Text
        </button>
        <button
          onClick={() => setTool("select")}
          className={`px-3 py-1 border rounded hover:scale-105 duration-300 ${
            tool === "select" ? "bg-black text-white" : ""
          }`}
        >
          Select
        </button>
      </div>
    </div>
  );
}
