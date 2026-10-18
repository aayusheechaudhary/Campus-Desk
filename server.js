/* Campus Desk server: serves the website from /public and the JSON API from /api. */

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/subjects", require("./routes/subjects"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/tasks", require("./routes/tasks"));

// Any other /api URL
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Last-resort error handler (bad JSON, database errors, ...)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: "Something went wrong on the server" });
});

app.listen(PORT, () => {
  console.log(`Campus Desk is running at http://localhost:${PORT}`);
});
