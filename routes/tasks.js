/* /api/tasks : Kanban board (column 0 = To do, 1 = In progress, 2 = Done) */

const express = require("express");
const db = require("../db");

const router = express.Router();

function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    deadline: row.deadline,
    column: row.column_index,
    completedOn: row.completed_on,
  };
}

// GET /api/tasks
router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM tasks ORDER BY id").all().map(toTask));
});

// POST /api/tasks  { title, deadline }
router.post("/", (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Task title is required" });

  const result = db
    .prepare("INSERT INTO tasks (title, deadline) VALUES (?, ?)")
    .run(title, String(req.body.deadline || ""));
  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /api/tasks/5  { column, completedOn }   (moves a task between columns)
router.patch("/:id", (req, res) => {
  const column = Number(req.body.column);
  if (![0, 1, 2].includes(column)) return res.status(400).json({ error: "column must be 0, 1 or 2" });

  db.prepare("UPDATE tasks SET column_index = ?, completed_on = ? WHERE id = ?")
    .run(column, column === 2 ? String(req.body.completedOn || "") : "", Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/tasks/5
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
