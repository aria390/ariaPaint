import { useEffect, useState } from "react";
import Canvas from "./Components/Canvas/canvas";
import Toolbar from "./Components/Toolbar/Toolbar";

function App() {
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<
    | "pencil"
    | "eraser"
    | "rectangle"
    | "fill"
    | "circle"
    | "arrow"
    | "text"
    | "select"
  >("pencil");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(16);

  useEffect(() => {
    document.title = "AriaPaint";
  }, []);

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <Toolbar
        color={color}
        setColor={setColor}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        tool={tool}
        setTool={setTool}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      <Canvas
        color={color}
        brushSize={brushSize}
        tool={tool}
        backgroundColor={backgroundColor}
        fontSize={fontSize}
      />
    </main>
  );
}

export default App;
