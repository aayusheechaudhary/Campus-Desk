/* /api/subjects : subjects and their attendance */

const express = require("express");
const db = require("../db");

const router = express.Router();

// Database row -> the shape the frontend uses
function toSubject(row) {
  return {
    id: row.id,
    name: row.name,
    minPercent: row.min_percent,
    days: row.days ? row.days.split(",").map(Number) : [],
    attended: row.attended,
    total: row.total,
    todayMark: row.today_mark || null,   // "present", "absent" or null
  };
}

// GET /api/subjects?date=2026-10-18  ->  all subjects, plus their mark for that date
router.get("/", (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, l.status AS today_mark
    FROM subjects s
    LEFT JOIN attendance_log l ON l.subject_id = s.id AND l.date = ?
    ORDER BY s.id
  `).all(req.query.date || "");
  res.json(rows.map(toSubject));
});

// POST /api/subjects  { name, minPercent, days: [1,2,3] }
router.post("/", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Subject name is required" });

  const minPercent = Math.min(99, Math.max(1, Number(req.body.minPercent) || 75));
  const days = (req.body.days || []).map(Number).filter((d) => d >= 0 && d <= 6).join(",");

  const result = db
    .prepare("INSERT INTO subjects (name, min_percent, days) VALUES (?, ?, ?)")
    .run(name, minPercent, days);
  res.status(201).json({ id: result.lastInsertRowid });
});

// POST /api/subjects/5/mark  { date, status }
// Marks a class present/absent. Clicking the same status again undoes it.
router.post("/:id/mark", (req, res) => {
  const id = Number(req.params.id);
  const { date, status } = req.body;
  if (!date || !["present", "absent"].includes(status)) {
    return res.status(400).json({ error: "date and status (present/absent) are required" });
  }

  // A transaction makes the log and the totals change together, or not at all
  const applyMark = db.transaction(() => {
    const old = db.prepare("SELECT status FROM attendance_log WHERE subject_id = ? AND date = ?").get(id, date);

    if (old) {
      db.prepare("DELETE FROM attendance_log WHERE subject_id = ? AND date = ?").run(id, date);
      db.prepare("UPDATE subjects SET total = total - 1, attended = attended - ? WHERE id = ?")
        .run(old.status === "present" ? 1 : 0, id);
      if (old.status === status) return;   // same button again: undo only
    }

    db.prepare("INSERT INTO attendance_log (subject_id, date, status) VALUES (?, ?, ?)").run(id, date, status);
    db.prepare("UPDATE subjects SET total = total + 1, attended = attended + ? WHERE id = ?")
      .run(status === "present" ? 1 : 0, id);
  });

  applyMark();
  res.json({ ok: true });
});

// POST /api/subjects/5/past  { present: true }
// Adds one past class to the totals (for classes before you started using the app)
router.post("/:id/past", (req, res) => {
  db.prepare("UPDATE subjects SET total = total + 1, attended = attended + ? WHERE id = ?")
    .run(req.body.present ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/subjects/5  (its attendance_log rows are removed automatically)
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM subjects WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
