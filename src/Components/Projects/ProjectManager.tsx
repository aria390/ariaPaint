import { useEffect, useState } from "react";
import { projectsApi, type Project } from "../../api/client";
import type { Shape } from "../../types/shapes";

type Props = {
  onClose: () => void;
  onLoadProject: (shapes: Shape[], bgColor: string) => void;
  onSaveProject: (name: string) => Promise<{ id: number; name: string }>;
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;
};

type ProjectMeta = Omit<Project, "shapes_data">;

export default function ProjectManager({
  onClose,
  onLoadProject,
  onSaveProject,
  currentProjectId,
  setCurrentProjectId,
}: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    projectsApi
      .list()
      .then(({ projects }) => setProjects(projects))
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = async (id: number) => {
    try {
      const { project } = await projectsApi.get(id);
      setCurrentProjectId(project.id);
      onLoadProject(project.shapes_data, project.background_color);
      onClose();
    } catch {
      setError("Failed to load project");
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSavingNew(true);
    try {
      const saved = await onSaveProject(newName.trim());
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        if (exists) return prev.map((p) => p.id === saved.id ? { ...p, name: saved.name } : p);
        return [{ ...saved } as ProjectMeta, ...prev];
      });
      setNewName("");
    } catch {
      setError("Failed to save project");
    } finally {
      setSavingNew(false);
    }
  };

  const handleRename = async (id: number) => {
    if (!renameValue.trim()) return;
    try {
      await projectsApi.update(id, { name: renameValue.trim() });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: renameValue.trim() } : p))
      );
      setRenamingId(null);
    } catch {
      setError("Failed to rename project");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await projectsApi.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProjectId === id) setCurrentProjectId(null);
      setDeletingId(null);
    } catch {
      setError("Failed to delete project");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-bold">My Projects</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 border-b bg-gray-50">
          <form onSubmit={handleCreateNew} className="flex gap-2">
            <input
              type="text"
              placeholder="Save current canvas as…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              disabled={savingNew || !newName.trim()}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingNew ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <p className="text-red-500 text-sm mb-3 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-3xl mb-2">🎨</p>
              <p>No projects yet. Save your first canvas above!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    currentProjectId === project.id
                      ? "border-black bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {renamingId === project.id ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(project.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <button
                        onClick={() => handleRename(project.id)}
                        className="px-2 py-1 bg-black text-white text-xs rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : deletingId === project.id ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-red-600">
                        Delete "{project.name}"?
                      </span>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {project.name}
                          {currentProjectId === project.id && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">
                              (current)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(project.updated_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLoad(project.id)}
                        className="px-2 py-1 bg-black text-white text-xs rounded hover:bg-gray-800"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => {
                          setRenamingId(project.id);
                          setRenameValue(project.name);
                        }}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => setDeletingId(project.id)}
                        className="px-2 py-1 bg-gray-100 text-red-500 text-xs rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
