/* /api/expenses : daily spending */

const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/expenses?month=2026-10  ->  that month's expenses, newest first
router.get("/", (req, res) => {
  const month = req.query.month || "";
  const rows = db
    .prepare("SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, id DESC")
    .all(month + "%");
  res.json(rows);
});

// POST /api/expenses  { amount, category, date, note }
router.post("/", (req, res) => {
  const amount = Number(req.body.amount);
  const category = String(req.body.category || "").trim();
  const date = String(req.body.date || "").trim();
  const note = String(req.body.note || "").trim();

  if (!(amount > 0)) return res.status(400).json({ error: "Amount must be more than 0" });
  if (!category || !date) return res.status(400).json({ error: "Category and date are required" });

  const result = db
    .prepare("INSERT INTO expenses (amount, category, date, note) VALUES (?, ?, ?, ?)")
    .run(amount, category, date, note);
  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/expenses/5
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM expenses WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
