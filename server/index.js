import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "ariapaint.db");
const JWT_SECRET = process.env.JWT_SECRET || "ariapaint-secret-key-dev-only";
const PORT = process.env.PORT || 3001;

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    shapes_data TEXT NOT NULL DEFAULT '[]',
    background_color TEXT NOT NULL DEFAULT '#ffffff',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

const DIST_PATH = path.join(__dirname, "../dist");
app.use(express.static(DIST_PATH));

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (username.length < 3) {
    return res
      .status(400)
      .json({ error: "Username must be at least 3 characters" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
    .get(email, username);
  if (existing) {
    return res.status(409).json({ error: "Username or email already taken" });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    )
    .run(username, email, password_hash);

  const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, {
    expiresIn: "30d",
  });
  res.json({ token, user: { id: result.lastInsertRowid, username, email } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email },
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = db
    .prepare("SELECT id, username, email FROM users WHERE id = ?")
    .get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

app.get("/api/projects", authMiddleware, (req, res) => {
  const projects = db
    .prepare(
      "SELECT id, name, background_color, updated_at, created_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .all(req.userId);
  res.json({ projects });
});

app.post("/api/projects", authMiddleware, (req, res) => {
  const { name, shapes_data, background_color } = req.body;
  if (!name) return res.status(400).json({ error: "Project name is required" });

  const result = db
    .prepare(
      "INSERT INTO projects (user_id, name, shapes_data, background_color) VALUES (?, ?, ?, ?)",
    )
    .run(
      req.userId,
      name,
      JSON.stringify(shapes_data || []),
      background_color || "#ffffff",
    );

  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(result.lastInsertRowid);
  res.json({ project });
});

app.get("/api/projects/:id", authMiddleware, (req, res) => {
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json({
    project: { ...project, shapes_data: JSON.parse(project.shapes_data) },
  });
});

app.put("/api/projects/:id", authMiddleware, (req, res) => {
  const { name, shapes_data, background_color } = req.body;
  const project = db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!project) return res.status(404).json({ error: "Project not found" });

  db.prepare(
    "UPDATE projects SET name = COALESCE(?, name), shapes_data = COALESCE(?, shapes_data), background_color = COALESCE(?, background_color), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(
    name || null,
    shapes_data !== undefined ? JSON.stringify(shapes_data) : null,
    background_color || null,
    req.params.id,
  );

  const updated = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(req.params.id);
  res.json({
    project: { ...updated, shapes_data: JSON.parse(updated.shapes_data) },
  });
});

app.delete("/api/projects/:id", authMiddleware, (req, res) => {
  const project = db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!project) return res.status(404).json({ error: "Project not found" });

  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/{*any}", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(DIST_PATH, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AriaPaint API running on http://localhost:${PORT}`);
});
