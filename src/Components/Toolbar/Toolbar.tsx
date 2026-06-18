type ToolbarProps = {
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;

  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;

  tool: "pencil" | "eraser";
  setTool: React.Dispatch<
    React.SetStateAction<"pencil" | "eraser">
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
    <section className="flex flex-col gap-2 items-center">
      <div className="flex items-center justify-center gap-4 rounded-lg border p-4">
        <label className="text-xl font-semibold">Color:</label>

        <input
          className="size-8"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label>Size:</label>

        <input
          type="range"
          min={1}
          max={50}
          value={brushSize}
          onChange={(event) => setBrushSize(Number(event.target.value))}
        />

        <span>{brushSize}px</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setTool("pencil")}
          className="rounded border px-4 py-2 hover:scale-105 hover:cursor-pointer duration-300"
        >
          Pencil
        </button>

        <button
          onClick={() => setTool("eraser")}
          className="rounded border px-4 py-2 hover:scale-105 hover:cursor-pointer duration-300"
        >
          Eraser
        </button>
      </div>
    </section>
  );
}
