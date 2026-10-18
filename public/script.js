/* ==========================================================
   Campus Desk (frontend)
   Talks to the Express server through /api. No data is kept
   in the browser: the server stores everything in SQLite.
 
   1. Setup & helpers   2. Theme & tabs   3. Attendance
   4. Expenses          5. Task board     6. Start the app
   ========================================================== */
 
 
/* ---------- 1. Setup & helpers ---------- */
 
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASK_COLUMNS = ["To do", "In progress", "Done"];
 
const $ = (selector) => document.querySelector(selector);
 
// Date -> "YYYY-MM-DD" in local time (the format <input type="date"> uses)
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
 
const TODAY = toISODate(new Date());
 
// Sends a request to the server and returns the JSON reply.
// Usage: await api("POST", "/api/tasks", { title: "..." })
async function api(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    alert("Can't reach the server. Is it running? (npm start)");
    throw error;
  }
 
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({}));
    alert(error || "Something went wrong");
    throw new Error(error || response.statusText);
  }
  return response.json();
}
 
// Stops user-typed text from being treated as HTML
function escapeHTML(text) {
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (char) => replacements[char]);
}
 
function formatRupees(amount) {
  return "₹" + amount.toLocaleString("en-IN");
}
 
 
/* ---------- 2. Theme & tabs ---------- */
 
$("#theme-toggle").onclick = () => {
  const root = document.documentElement;
  const isDark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = isDark ? "light" : "dark";
};
 
document.querySelectorAll("nav button").forEach((tabButton) => {
  tabButton.onclick = () => {
    document.querySelectorAll("nav button").forEach((other) => {
      other.setAttribute("aria-selected", other === tabButton);
    });
    ["attendance", "expenses", "tasks"].forEach((id) => {
      $("#" + id).hidden = id !== tabButton.dataset.tab;
    });
  };
});
 
 
/* ---------- 3. Attendance & bunk manager ---------- */
 
let subjects = [];
 
// Day checkboxes in the "Add a subject" form (Mon-Fri ticked by default)
$("#subject-days").innerHTML = WEEKDAYS.map((day, index) => {
  const isWeekday = index > 0 && index < 6;
  return `<label><input type="checkbox" value="${index}" ${isWeekday ? "checked" : ""}>${day}</label>`;
}).join("");
 
async function loadSubjects() {
  subjects = await api("GET", `/api/subjects?date=${TODAY}`);
  renderAttendance();
}
 
$("#add-subject").onclick = async () => {
  const name = $("#subject-name").value.trim();
  if (!name) {
    $("#subject-name").focus();
    return;
  }
 
  await api("POST", "/api/subjects", {
    name,
    minPercent: Number($("#subject-min").value) || 75,
    days: [...document.querySelectorAll("#subject-days input:checked")].map((box) => Number(box.value)),
  });
 
  $("#subject-name").value = "";
  loadSubjects();
};
 
// Works out the percentage and what the student should do next
function getAttendanceStatus(subject) {
  const { attended, total, minPercent } = subject;
 
  if (total === 0) {
    return { percent: 0, tone: "ok", message: "No classes logged yet" };
  }
 
  const percent = (attended / total) * 100;
 
  if (percent >= minPercent) {
    // Classes that can be skipped while staying at or above the minimum
    const canSkip = Math.floor((attended * 100) / minPercent - total);
    return canSkip > 0
      ? { percent, tone: "ok",   message: `You can skip ${canSkip} more ${canSkip > 1 ? "classes" : "class"}` }
      : { percent, tone: "warn", message: "On the line: attend the next class" };
  }
 
  // Classes needed in a row to climb back up to the minimum
  const mustAttend = Math.ceil((minPercent * total - 100 * attended) / (100 - minPercent));
  return {
    percent,
    tone: "bad",
    message: `Attend the next ${mustAttend} ${mustAttend > 1 ? "classes" : "class"} to reach ${minPercent}%`,
  };
}
 
function renderAttendance() {
  renderTodayList();
  renderSubjectCards();
}
 
function renderTodayList() {
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  $("#today-heading").textContent = "Today, " + todayLabel;
 
  const todaysSubjects = subjects.filter((s) => s.days.includes(new Date().getDay()));
 
  if (todaysSubjects.length === 0) {
    $("#today-list").innerHTML =
      '<p class="muted">No classes scheduled today. Add subjects with their class days above.</p>';
    return;
  }
 
  $("#today-list").innerHTML = todaysSubjects.map((subject) => `
    <div class="today-row">
      <strong>${escapeHTML(subject.name)}</strong>
      <span>
        <button class="btn small ${subject.todayMark === "present" ? "is-present" : ""}" data-mark="${subject.id}" data-value="present" type="button">Present</button>
        <button class="btn small ${subject.todayMark === "absent" ? "is-absent" : ""}" data-mark="${subject.id}" data-value="absent" type="button">Absent</button>
      </span>
    </div>`).join("");
}
 
function renderSubjectCards() {
  $("#subject-cards").innerHTML = subjects.map((subject) => {
    const status = getAttendanceStatus(subject);
    const percentText = subject.total ? status.percent.toFixed(1) : "–";
    const days = subject.days.map((d) => WEEKDAYS[d]).join(", ") || "no fixed days";
 
    return `
      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <h3>${escapeHTML(subject.name)}</h3>
          <button class="btn small danger" data-delete-subject="${subject.id}" type="button" aria-label="Delete ${escapeHTML(subject.name)}">Delete</button>
        </div>
        <div class="percent">${percentText}%</div>
        <div class="bar"><i style="width: ${Math.min(100, status.percent)}%"></i></div>
        <span class="tag ${status.tone}">${status.message}</span>
        <p class="muted" style="margin: 10px 0 6px">
          ${subject.attended} attended of ${subject.total} · minimum ${subject.minPercent}% · ${days}
        </p>
        <button class="btn small" data-past="${subject.id}" data-present="true" type="button">+ Present</button>
        <button class="btn small" data-past="${subject.id}" data-present="false" type="button">+ Absent</button>
      </div>`;
  }).join("");
}
 
// One click listener per list (event delegation) instead of one per button
$("#today-list").onclick = async (event) => {
  const button = event.target.closest("[data-mark]");
  if (!button) return;
  await api("POST", `/api/subjects/${button.dataset.mark}/mark`, { date: TODAY, status: button.dataset.value });
  loadSubjects();
};
 
$("#subject-cards").onclick = async (event) => {
  const pastButton = event.target.closest("[data-past]");
  if (pastButton) {
    await api("POST", `/api/subjects/${pastButton.dataset.past}/past`, { present: pastButton.dataset.present === "true" });
    loadSubjects();
  }
 
  const deleteButton = event.target.closest("[data-delete-subject]");
  if (deleteButton && confirm("Delete this subject and its attendance?")) {
    await api("DELETE", `/api/subjects/${deleteButton.dataset.deleteSubject}`);
    loadSubjects();
  }
};
 
 
/* ---------- 4. Expense tracker ---------- */
 
$("#expense-date").value = TODAY;
$("#expense-month").value = TODAY.slice(0, 7);   // "YYYY-MM"
$("#expense-month").onchange = loadExpenses;
 
$("#add-expense").onclick = async () => {
  const amount = Number($("#expense-amount").value);
  if (!(amount > 0)) {
    $("#expense-amount").focus();
    return;
  }
 
  await api("POST", "/api/expenses", {
    amount,
    category: $("#expense-category").value,
    date: $("#expense-date").value || TODAY,
    note: $("#expense-note").value.trim(),
  });
 
  $("#expense-amount").value = "";
  $("#expense-note").value = "";
  loadExpenses();
};
 
async function loadExpenses() {
  const month = $("#expense-month").value || TODAY.slice(0, 7);
  renderExpenses(await api("GET", `/api/expenses?month=${month}`));
}
 
function renderExpenses(monthExpenses) {
  const total = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  $("#expense-total").textContent = formatRupees(total);
 
  // Add up spending per category
  const totalsByCategory = {};
  monthExpenses.forEach((expense) => {
    totalsByCategory[expense.category] = (totalsByCategory[expense.category] || 0) + expense.amount;
  });
 
  const breakdownHTML = Object.entries(totalsByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `
      <div class="category-row">
        <span>${escapeHTML(category)}</span>
        <div class="bar"><i style="width: ${(amount / total) * 100}%"></i></div>
        <span style="text-align: right">${formatRupees(amount)}</span>
      </div>`)
    .join("");
 
  $("#expense-breakdown").innerHTML = breakdownHTML || '<p class="muted">Nothing logged for this month yet.</p>';
 
  const listHTML = monthExpenses.map((expense) => `
    <div class="expense-item">
      <span>
        <strong>${formatRupees(expense.amount)}</strong> ${escapeHTML(expense.category)}<br>
        <span class="muted">${expense.date}${expense.note ? " · " + escapeHTML(expense.note) : ""}</span>
      </span>
      <button class="btn small danger" data-delete-expense="${expense.id}" type="button">Delete</button>
    </div>`).join("");
 
  $("#expense-list").innerHTML = listHTML || '<p class="muted">No entries yet.</p>';
}
 
$("#expense-list").onclick = async (event) => {
  const button = event.target.closest("[data-delete-expense]");
  if (!button) return;
  await api("DELETE", `/api/expenses/${button.dataset.deleteExpense}`);
  loadExpenses();
};
 
 
/* ---------- 5. Task board (Kanban with subtasks) ---------- */
 
let tasks = [];
 
async function loadTasks() {
  tasks = await api("GET", "/api/tasks");
  renderTasks();
}
 
$("#add-task").onclick = async () => {
  const title = $("#task-title").value.trim();
  if (!title) {
    $("#task-title").focus();
    return;
  }
 
  await api("POST", "/api/tasks", { title, deadline: $("#task-deadline").value });
 
  $("#task-title").value = "";
  $("#task-deadline").value = "";
  loadTasks();
};
 
function describeTaskDate(task, isOverdue) {
  if (task.column === 2) return "Finished " + task.completedOn;
  if (!task.deadline) return "No deadline";
  return (isOverdue ? "Overdue, was due " : "Due ") + task.deadline;
}
 
// The checklist part of a task card: progress bar, checkboxes, "add subtask" box
function renderSubtasks(task, columnIndex) {
  const total = task.subtasks.length;
  const doneCount = task.subtasks.filter((sub) => sub.done).length;
 
  const progressHTML = total === 0 ? "" : `
    <div class="subtask-progress">
      <div class="bar"><i style="width: ${(doneCount / total) * 100}%"></i></div>
      <span class="muted">${doneCount}/${total} done</span>
    </div>`;
 
  const hintHTML = total > 0 && doneCount === total && columnIndex < 2
    ? '<span class="tag ok">All subtasks done. Move it to Done?</span>'
    : "";
 
  const itemsHTML = task.subtasks.map((sub) => `
    <div class="subtask ${sub.done ? "is-done" : ""}">
      <label>
        <input type="checkbox" data-toggle-subtask="${sub.id}" data-task="${task.id}" ${sub.done ? "checked" : ""}>
        <span>${escapeHTML(sub.title)}</span>
      </label>
      <button class="icon-btn" data-delete-subtask="${sub.id}" data-task="${task.id}" type="button" aria-label="Delete subtask">×</button>
    </div>`).join("");
 
  return `
    ${progressHTML}
    ${hintHTML}
    ${itemsHTML}
    <div class="subtask-add">
      <input data-subtask-input="${task.id}" placeholder="Add a subtask" maxlength="100" aria-label="New subtask">
      <button class="btn small" data-add-subtask="${task.id}" type="button">Add</button>
    </div>`;
}
 
function renderTasks() {
  $("#board").innerHTML = TASK_COLUMNS.map((columnName, columnIndex) => {
    // Earliest deadline first; tasks without a deadline go last
    const columnTasks = tasks
      .filter((task) => task.column === columnIndex)
      .sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
 
    const cardsHTML = columnTasks.map((task) => {
      const isOverdue = Boolean(task.deadline) && task.deadline < TODAY && columnIndex < 2;
      return `
        <div class="task ${isOverdue ? "overdue" : ""}">
          <strong>${escapeHTML(task.title)}</strong><br>
          <span class="muted">${describeTaskDate(task, isOverdue)}</span>
          ${renderSubtasks(task, columnIndex)}
          <div class="task-actions">
            ${columnIndex > 0 ? `<button class="btn small" data-move="${task.id}" data-step="-1" type="button" aria-label="Move back">←</button>` : ""}
            ${columnIndex < 2 ? `<button class="btn small" data-move="${task.id}" data-step="1" type="button" aria-label="Move forward">→</button>` : ""}
            <button class="btn small danger" data-delete-task="${task.id}" type="button">Delete</button>
          </div>
        </div>`;
    }).join("");
 
    return `
      <div class="column">
        <h3>${columnName}<span class="muted">${columnTasks.length}</span></h3>
        ${cardsHTML || '<p class="muted">Empty</p>'}
      </div>`;
  }).join("");
}
 
async function addSubtask(taskId) {
  const input = document.querySelector(`[data-subtask-input="${taskId}"]`);
  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }
  await api("POST", `/api/tasks/${taskId}/subtasks`, { title });
  await loadTasks();
  // Put the cursor back so several subtasks can be typed one after another
  document.querySelector(`[data-subtask-input="${taskId}"]`).focus();
}
 
$("#board").onclick = async (event) => {
  const moveButton = event.target.closest("[data-move]");
  if (moveButton) {
    const task = tasks.find((t) => t.id === Number(moveButton.dataset.move));
    await api("PATCH", `/api/tasks/${task.id}`, {
      column: task.column + Number(moveButton.dataset.step),
      completedOn: TODAY,
    });
    loadTasks();
  }
 
  const deleteButton = event.target.closest("[data-delete-task]");
  if (deleteButton) {
    await api("DELETE", `/api/tasks/${deleteButton.dataset.deleteTask}`);
    loadTasks();
  }
 
  const addButton = event.target.closest("[data-add-subtask]");
  if (addButton) addSubtask(addButton.dataset.addSubtask);
 
  const deleteSubtaskButton = event.target.closest("[data-delete-subtask]");
  if (deleteSubtaskButton) {
    await api("DELETE", `/api/tasks/${deleteSubtaskButton.dataset.task}/subtasks/${deleteSubtaskButton.dataset.deleteSubtask}`);
    loadTasks();
  }
};
 
// Ticking or unticking a subtask checkbox
$("#board").onchange = async (event) => {
  const checkbox = event.target.closest("[data-toggle-subtask]");
  if (!checkbox) return;
  await api("PATCH", `/api/tasks/${checkbox.dataset.task}/subtasks/${checkbox.dataset.toggleSubtask}`, {
    done: checkbox.checked,
  });
  loadTasks();
};
 
// Pressing Enter in the "Add a subtask" box
$("#board").onkeydown = (event) => {
  const input = event.target.closest("[data-subtask-input]");
  if (input && event.key === "Enter") addSubtask(input.dataset.subtaskInput);
};
 
 
/* ---------- 6. Start the app ---------- */
 
loadSubjects();
loadExpenses();
loadTasks();