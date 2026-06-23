import type { ToolType } from "../Canvas/canvas";

type ToolbarProps = {
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  tool: ToolType;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  backgroundColor: string;
  setBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  user: { username: string; email: string } | null;
  currentProjectName: string | null;
  onAuthClick: () => void;
  onProjectsClick: () => void;
  onLogout: () => void;
};

const TOOLS: { id: ToolType; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "rectangle", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "arrow", label: "Arrow" },
  { id: "fill", label: "Fill" },
  { id: "text", label: "Text" },
  { id: "select", label: "Select" },
];

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
  user,
  currentProjectName,
  onAuthClick,
  onProjectsClick,
  onLogout,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg w-full max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex gap-6 flex-wrap items-start">
          <section className="flex flex-col gap-1 relative">
            <div className="flex items-center gap-2">
              <span className="text-sm">Color:</span>
              <input
                className="size-8 cursor-pointer"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Background:</span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="size-8 cursor-pointer"
              />
            </div>
          </section>

          <section className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm whitespace-nowrap">Brush:</span>
              <input
                type="range"
                min={1}
                max={50}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-sm w-8">{brushSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm whitespace-nowrap">Text:</span>
              <input
                type="range"
                min={10}
                max={80}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-sm w-8">{fontSize}px</span>
            </div>
          </section>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <img
            className="h-12 w-auto"
            src="/AriaPaint.jpg"
            alt="AriaPaint"
          />

          {user ? (
            <div className="flex items-center gap-2">
              {currentProjectName && (
                <span className="text-xs text-gray-500 hidden sm:block">
                  📁 {currentProjectName}
                </span>
              )}
              <button
                onClick={onProjectsClick}
                className="px-3 py-1.5 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
              >
                Projects
              </button>
              <div className="flex items-center gap-1 border rounded-lg px-2 py-1.5">
                <span className="text-sm font-medium hidden sm:block">
                  {user.username}
                </span>
                <button
                  onClick={onLogout}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="px-3 py-1.5 border border-black text-sm rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TOOLS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`px-3 py-1 border rounded hover:scale-105 duration-200 text-sm ${
              tool === id ? "bg-black text-white" : "hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tool === "pencil" || tool === "eraser") && (
        <p className="text-xs text-gray-400">
          Tip: click any shape with Rectangle, Circle, Arrow, or Select to move it.
        </p>
      )}
    </div>
  );
}
