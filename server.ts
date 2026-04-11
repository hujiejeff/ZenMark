import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("bookmarks.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    icon TEXT,
    padding INTEGER,
    roundness INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add padding and roundness if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(bookmarks)").all() as any[];
const columnNames = tableInfo.map(info => info.name);

if (!columnNames.includes('padding')) {
  db.exec("ALTER TABLE bookmarks ADD COLUMN padding INTEGER");
}
if (!columnNames.includes('roundness')) {
  db.exec("ALTER TABLE bookmarks ADD COLUMN roundness INTEGER");
}

// Migration: Seed categories from existing bookmarks
const existingCategories = db.prepare("SELECT DISTINCT category FROM bookmarks WHERE category != 'Uncategorized'").all() as { category: string }[];
for (const cat of existingCategories) {
  try {
    db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(cat.category);
  } catch (e) {
    // Ignore duplicates
  }
}

// Seed default bookmarks if empty
const count = db.prepare("SELECT COUNT(*) as count FROM bookmarks").get() as { count: number };
if (count.count === 0) {
  const defaults = [
    { title: "Google", url: "https://www.google.com", category: "Search" },
    { title: "GitHub", url: "https://github.com", category: "Tech" },
    { title: "YouTube", url: "https://www.youtube.com", category: "Video" },
    { title: "Twitter / X", url: "https://twitter.com", category: "Social" },
    { title: "Reddit", url: "https://www.reddit.com", category: "Social" },
    { title: "Stack Overflow", url: "https://stackoverflow.com", category: "Tech" },
    { title: "ChatGPT", url: "https://chat.openai.com", category: "AI" },
    { title: "Dribbble", url: "https://dribbble.com", category: "Design" },
    { title: "Netflix", url: "https://www.netflix.com", category: "Entertainment" },
    { title: "Wikipedia", url: "https://www.wikipedia.org", category: "Learning" },
    { title: "Product Hunt", url: "https://www.producthunt.com", category: "Tools" },
    { title: "Medium", url: "https://medium.com", category: "Learning" },
    { title: "Facebook", url: "https://facebook.com", category: "Social" },
    { title: "Instagram", url: "https://instagram.com", category: "Social" },
    { title: "LinkedIn", url: "https://linkedin.com", category: "Social" },
    { title: "Pinterest", url: "https://pinterest.com", category: "Social" },
    { title: "TikTok", url: "https://tiktok.com", category: "Social" },
    { title: "Snapchat", url: "https://snapchat.com", category: "Social" },
    { title: "Twitch", url: "https://twitch.tv", category: "Social" },
    { title: "Discord", url: "https://discord.com", category: "Social" },
    { title: "WhatsApp", url: "https://whatsapp.com", category: "Social" }
  ];

  const insert = db.prepare("INSERT INTO bookmarks (title, url, category) VALUES (?, ?, ?)");
  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item.title, item.url, item.category);
  });
  insertMany(defaults);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/bookmarks", (req, res) => {
    try {
      console.log("GET /api/bookmarks");
      const bookmarks = db.prepare("SELECT * FROM bookmarks ORDER BY created_at DESC").all();
      const categories = db.prepare("SELECT * FROM categories ORDER BY created_at ASC").all();
      res.json({ bookmarks, categories });
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/categories", (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const info = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete("/api/categories/:name", (req, res) => {
    try {
      const { name } = req.params;
      db.prepare("DELETE FROM categories WHERE name = ?").run(name);
      // Optional: move bookmarks to Uncategorized? 
      // The frontend already handles this by filtering or we can do it here.
      db.prepare("UPDATE bookmarks SET category = 'Uncategorized' WHERE category = ?").run(name);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.patch("/api/categories/:oldName", (req, res) => {
    try {
      const { oldName } = req.params;
      const { newName } = req.body;
      if (!newName) return res.status(400).json({ error: "New name is required" });
      
      db.prepare("UPDATE categories SET name = ? WHERE name = ?").run(newName, oldName);
      db.prepare("UPDATE bookmarks SET category = ? WHERE category = ?").run(newName, oldName);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error renaming category:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/bookmarks", (req, res) => {
    try {
      console.log("POST /api/bookmarks", req.body);
      const { title, url, category, icon } = req.body;
      const info = db.prepare("INSERT INTO bookmarks (title, url, category, icon) VALUES (?, ?, ?, ?)")
        .run(title, url, category || 'Uncategorized', icon || null);
      res.json({ id: info.lastInsertRowid, title, url, category, icon });
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete("/api/bookmarks/:id", (req, res) => {
    db.prepare("DELETE FROM bookmarks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/bookmarks/:id", (req, res) => {
    const { title, url, category } = req.body;
    db.prepare("UPDATE bookmarks SET title = ?, url = ?, category = ? WHERE id = ?")
      .run(title, url, category, req.params.id);
    const updated = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(req.params.id);
    res.json(updated);
  });

  app.patch("/api/bookmarks/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const allowedFields = ['title', 'url', 'category', 'icon', 'padding', 'roundness'];
      const fieldsToUpdate = Object.keys(updates).filter(key => allowedFields.includes(key));
      
      if (fieldsToUpdate.length === 0) {
        const current = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id);
        return res.json(current);
      }

      const setClause = fieldsToUpdate.map(key => `${key} = ?`).join(', ');
      const values = fieldsToUpdate.map(key => updates[key]);
      
      db.prepare(`UPDATE bookmarks SET ${setClause} WHERE id = ?`).run(...values, id);
      
      const updated = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id);
      res.json(updated);
    } catch (error) {
      console.error("Error patching bookmark:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // AI Classification Route
  app.post("/api/ai/classify", async (req, res) => {
    const { title, url } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Classify this bookmark into a single, short category (e.g., 'Tech', 'Social', 'News', 'Tools', 'Design', 'Learning'). 
        Title: ${title}
        URL: ${url}
        Return ONLY the category name as a single word or short phrase.`,
      });

      const category = response.text?.trim() || "Uncategorized";
      res.json({ category });
    } catch (error) {
      console.error("AI Classification error:", error);
      res.status(500).json({ error: "Failed to classify bookmark" });
    }
  });

  app.put("/api/bookmarks/:id/category", (req, res) => {
    const { category } = req.body;
    db.prepare("UPDATE bookmarks SET category = ? WHERE id = ?")
      .run(category, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
