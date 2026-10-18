/* /api/tasks : Kanban board (column 0 = To do, 1 = In progress, 2 = Done)
   Each task can have subtasks (a checklist). */
 
const express = require("express");
const db = require("../db");
 
const router = express.Router();
 
function toTask(row, subtasks) {
  return {
    id: row.id,
    title: row.title,
    deadline: row.deadline,
    column: row.column_index,
    completedOn: row.completed_on,
    subtasks: subtasks
      .filter((sub) => sub.task_id === row.id)
      .map((sub) => ({ id: sub.id, title: sub.title, done: Boolean(sub.done) })),
  };
}
 
// GET /api/tasks  ->  every task with its subtasks inside
router.get("/", (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks ORDER BY id").all();
  const subtasks = db.prepare("SELECT * FROM subtasks ORDER BY id").all();
  res.json(tasks.map((task) => toTask(task, subtasks)));
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
 
// DELETE /api/tasks/5  (its subtasks are removed automatically)
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});
 
 
/* ---------- Subtasks ---------- */
 
// POST /api/tasks/5/subtasks  { title }
router.post("/:id/subtasks", (req, res) => {
  const taskId = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Subtask title is required" });
 
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) return res.status(404).json({ error: "Task not found" });
 
  const result = db.prepare("INSERT INTO subtasks (task_id, title) VALUES (?, ?)").run(taskId, title);
  res.status(201).json({ id: result.lastInsertRowid });
});
 
// PATCH /api/tasks/5/subtasks/12  { done: true }   (tick or untick)
router.patch("/:id/subtasks/:subId", (req, res) => {
  db.prepare("UPDATE subtasks SET done = ? WHERE id = ? AND task_id = ?")
    .run(req.body.done ? 1 : 0, Number(req.params.subId), Number(req.params.id));
  res.json({ ok: true });
});
 
// DELETE /api/tasks/5/subtasks/12
router.delete("/:id/subtasks/:subId", (req, res) => {
  db.prepare("DELETE FROM subtasks WHERE id = ? AND task_id = ?")
    .run(Number(req.params.subId), Number(req.params.id));
  res.json({ ok: true });
});
 
module.exports = router;