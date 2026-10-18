/* ==========================================================
   Campus Desk
   1. Setup & helpers   2. Theme & tabs   3. Attendance
   4. Expenses          5. Task board     6. Start the app
   ========================================================== */


/* ---------- 1. Setup & helpers ---------- */

const STORAGE_KEY = "campusdesk";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASK_COLUMNS = ["To do", "In progress", "Done"];

// All app data lives in this one object and is saved to localStorage
let state = loadState();

const $ = (selector) => document.querySelector(selector);

function loadState() {
  const empty = { subjects: [], expenses: [], tasks: [] };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...empty, ...JSON.parse(saved) } : empty;
  } catch (error) {
    return empty;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Storage can be blocked (private mode); the app still works for this session
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Date -> "YYYY-MM-DD" in local time (the format <input type="date"> uses)
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TODAY = toISODate(new Date());

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

// Day checkboxes in the "Add a subject" form (Mon-Fri ticked by default)
$("#subject-days").innerHTML = WEEKDAYS.map((day, index) => {
  const isWeekday = index > 0 && index < 6;
  return `<label><input type="checkbox" value="${index}" ${isWeekday ? "checked" : ""}>${day}</label>`;
}).join("");

$("#add-subject").onclick = () => {
  const name = $("#subject-name").value.trim();
  if (!name) {
    $("#subject-name").focus();
    return;
  }

  const minPercent = Math.min(99, Math.max(1, Number($("#subject-min").value) || 75));
  const days = [...document.querySelectorAll("#subject-days input:checked")].map((box) => Number(box.value));

  state.subjects.push({
    id: makeId(),
    name,
    minPercent,
    days,        // weekday numbers: 0 = Sunday ... 6 = Saturday
    attended: 0,
    total: 0,
    log: {},     // { "2026-10-18": "present" | "absent" }
  });

  $("#subject-name").value = "";
  saveState();
  renderAttendance();
};

// Mark today's class as present/absent. Clicking the same button again undoes it.
function markToday(subjectId, newMark) {
  const subject = state.subjects.find((s) => s.id === subjectId);
  const oldMark = subject.log[TODAY];

  // Remove the old mark from the totals first
  if (oldMark === "present") { subject.attended--; subject.total--; }
  if (oldMark === "absent")  { subject.total--; }

  if (newMark === oldMark) {
    delete subject.log[TODAY];
  } else {
    subject.log[TODAY] = newMark;
    subject.total++;
    if (newMark === "present") subject.attended++;
  }

  saveState();
  renderAttendance();
}

// Manually add a past class (for classes attended before you started using the app)
function addPastClass(subjectId, wasPresent) {
  const subject = state.subjects.find((s) => s.id === subjectId);
  subject.total++;
  if (wasPresent) subject.attended++;
  saveState();
  renderAttendance();
}

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

  const todaysSubjects = state.subjects.filter((s) => s.days.includes(new Date().getDay()));

  if (todaysSubjects.length === 0) {
    $("#today-list").innerHTML =
      '<p class="muted">No classes scheduled today. Add subjects with their class days above.</p>';
    return;
  }

  $("#today-list").innerHTML = todaysSubjects.map((subject) => {
    const mark = subject.log[TODAY];
    return `
      <div class="today-row">
        <strong>${escapeHTML(subject.name)}</strong>
        <span>
          <button class="btn small ${mark === "present" ? "is-present" : ""}" data-mark="${subject.id}" data-value="present" type="button">Present</button>
          <button class="btn small ${mark === "absent" ? "is-absent" : ""}" data-mark="${subject.id}" data-value="absent" type="button">Absent</button>
        </span>
      </div>`;
  }).join("");
}

function renderSubjectCards() {
  $("#subject-cards").innerHTML = state.subjects.map((subject) => {
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
$("#today-list").onclick = (event) => {
  const button = event.target.closest("[data-mark]");
  if (button) markToday(button.dataset.mark, button.dataset.value);
};

$("#subject-cards").onclick = (event) => {
  const pastButton = event.target.closest("[data-past]");
  if (pastButton) {
    addPastClass(pastButton.dataset.past, pastButton.dataset.present === "true");
  }

  const deleteButton = event.target.closest("[data-delete-subject]");
  if (deleteButton && confirm("Delete this subject and its attendance?")) {
    state.subjects = state.subjects.filter((s) => s.id !== deleteButton.dataset.deleteSubject);
    saveState();
    renderAttendance();
  }
};


/* ---------- 4. Expense tracker ---------- */

$("#expense-date").value = TODAY;
$("#expense-month").value = TODAY.slice(0, 7);   // "YYYY-MM"
$("#expense-month").onchange = renderExpenses;

$("#add-expense").onclick = () => {
  const amount = Number($("#expense-amount").value);
  if (!(amount > 0)) {
    $("#expense-amount").focus();
    return;
  }

  state.expenses.push({
    id: makeId(),
    amount,
    category: $("#expense-category").value,
    date: $("#expense-date").value || TODAY,
    note: $("#expense-note").value.trim(),
  });

  $("#expense-amount").value = "";
  $("#expense-note").value = "";
  saveState();
  renderExpenses();
};

function renderExpenses() {
  const month = $("#expense-month").value || TODAY.slice(0, 7);

  // This month's expenses, newest first
  const monthExpenses = state.expenses
    .filter((expense) => expense.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

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

$("#expense-list").onclick = (event) => {
  const button = event.target.closest("[data-delete-expense]");
  if (!button) return;
  state.expenses = state.expenses.filter((e) => e.id !== button.dataset.deleteExpense);
  saveState();
  renderExpenses();
};


/* ---------- 5. Task board (Kanban) ---------- */

$("#add-task").onclick = () => {
  const title = $("#task-title").value.trim();
  if (!title) {
    $("#task-title").focus();
    return;
  }

  state.tasks.push({
    id: makeId(),
    title,
    deadline: $("#task-deadline").value,
    column: 0,           // index into TASK_COLUMNS
    completedOn: "",
  });

  $("#task-title").value = "";
  $("#task-deadline").value = "";
  saveState();
  renderTasks();
};

function describeTaskDate(task, isOverdue) {
  if (task.column === 2) return "Finished " + task.completedOn;
  if (!task.deadline) return "No deadline";
  return (isOverdue ? "Overdue, was due " : "Due ") + task.deadline;
}

function renderTasks() {
  $("#board").innerHTML = TASK_COLUMNS.map((columnName, columnIndex) => {
    // Earliest deadline first; tasks without a deadline go last
    const columnTasks = state.tasks
      .filter((task) => task.column === columnIndex)
      .sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));

    const cardsHTML = columnTasks.map((task) => {
      const isOverdue = Boolean(task.deadline) && task.deadline < TODAY && columnIndex < 2;
      return `
        <div class="task ${isOverdue ? "overdue" : ""}">
          <strong>${escapeHTML(task.title)}</strong><br>
          <span class="muted">${describeTaskDate(task, isOverdue)}</span>
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

$("#board").onclick = (event) => {
  const moveButton = event.target.closest("[data-move]");
  if (moveButton) {
    const task = state.tasks.find((t) => t.id === moveButton.dataset.move);
    task.column += Number(moveButton.dataset.step);
    task.completedOn = task.column === 2 ? TODAY : "";
    saveState();
    renderTasks();
  }

  const deleteButton = event.target.closest("[data-delete-task]");
  if (deleteButton) {
    state.tasks = state.tasks.filter((t) => t.id !== deleteButton.dataset.deleteTask);
    saveState();
    renderTasks();
  }
};


/* ---------- 6. Start the app ---------- */

renderAttendance();
renderExpenses();
renderTasks();
