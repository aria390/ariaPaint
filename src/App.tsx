import { useState } from "react";
import Canvas from "./Components/Canvas/canvas";
import Toolbar from "./Components/Toolbar/Toolbar";

function App() {
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <Toolbar
        color={color}
        setColor={setColor}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        tool={tool}
        setTool={setTool}
      />

      <Canvas color={color} brushSize={brushSize} tool={tool} />
    </main>
  );
}

export default App;
