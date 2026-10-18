# Campus Desk

Attendance (bunk) manager, expense tracker and task board for students.
Frontend: HTML, CSS, vanilla JavaScript. Backend: Node.js, Express, SQLite.

## Run it

1. Install Node.js (version 18 or newer) from https://nodejs.org
2. In this folder, run:

       npm install
       npm start

3. Open http://localhost:3000

The database is created automatically as `campusdesk.db` the first time the server starts.

## Folder structure

    server.js          starts the server, serves /public and the API
    db.js              opens the SQLite file and creates the tables
    routes/            one file per tool: subjects.js, expenses.js, tasks.js
    public/            the website: index.html, style.css, script.js

## API

    GET    /api/subjects?date=YYYY-MM-DD
    POST   /api/subjects                 { name, minPercent, days }
    POST   /api/subjects/:id/mark        { date, status }
    POST   /api/subjects/:id/past        { present }
    DELETE /api/subjects/:id

    GET    /api/expenses?month=YYYY-MM
    POST   /api/expenses                 { amount, category, date, note }
    DELETE /api/expenses/:id

    GET    /api/tasks
    POST   /api/tasks                    { title, deadline }
    PATCH  /api/tasks/:id                { column, completedOn }
    DELETE /api/tasks/:id
