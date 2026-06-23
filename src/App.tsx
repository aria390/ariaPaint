import { useEffect, useRef, useState } from "react";
import Canvas, { type CanvasHandle, type ToolType } from "./Components/Canvas/canvas";
import Toolbar from "./Components/Toolbar/Toolbar";
import AuthModal from "./Components/Auth/AuthModal";
import ProjectManager from "./Components/Projects/ProjectManager";
import { useAuth } from "./contexts/AuthContext";
import { projectsApi } from "./api/client";

function App() {
  const { user, logout } = useAuth();

  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<ToolType>("pencil");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(16);

  const [showAuth, setShowAuth] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle | null>(null);

  useEffect(() => {
    document.title = "AriaPaint";
  }, []);

  const handleSaveProject = async (name: string): Promise<{ id: number; name: string; updated_at: string; created_at: string; user_id: number; background_color: string }> => {
    if (!canvasRef.current) throw new Error("Canvas not ready");
    const shapes = canvasRef.current.getShapes();
    const bgColor = canvasRef.current.getBackgroundColor();

    if (currentProjectId) {
      const { project } = await projectsApi.update(currentProjectId, {
        name,
        shapes_data: shapes,
        background_color: bgColor,
      });
      setCurrentProjectName(name);
      return project;
    } else {
      const { project } = await projectsApi.create(name, shapes, bgColor);
      setCurrentProjectId(project.id);
      setCurrentProjectName(project.name);
      return project;
    }
  };

  const handleLoadProject = (shapes: Parameters<CanvasHandle["loadProject"]>[0], bgColor: string) => {
    canvasRef.current?.loadProject(shapes, bgColor);
  };

  const handleLogout = () => {
    logout();
    setCurrentProjectId(null);
    setCurrentProjectName(null);
  };

  return (
    <main className="flex flex-col items-center gap-4 p-4">
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
        user={user}
        currentProjectName={currentProjectName}
        onAuthClick={() => setShowAuth(true)}
        onProjectsClick={() => {
          if (!user) {
            setShowAuth(true);
          } else {
            setShowProjects(true);
          }
        }}
        onLogout={handleLogout}
      />

      <Canvas
        ref={canvasRef}
        color={color}
        brushSize={brushSize}
        tool={tool}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        fontSize={fontSize}
      />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {showProjects && user && (
        <ProjectManager
          onClose={() => setShowProjects(false)}
          onLoadProject={handleLoadProject}
          onSaveProject={handleSaveProject}
          currentProjectId={currentProjectId}
          setCurrentProjectId={(id) => {
            setCurrentProjectId(id);
            setCurrentProjectName(null);
          }}
        />
      )}
    </main>
  );
}

export default App;
