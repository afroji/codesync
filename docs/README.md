# CodeSync — Real-Time Collaborative Code Editor

A real-time collaborative code editor built with Node.js, Socket.IO, and Monaco Editor. Multiple users can write and run code together in a shared session.

## Features

- Real-time code sync across all connected users
- Monaco Editor (VS Code's editor engine) with syntax highlighting and IntelliSense
- Multi-language support: Python, JavaScript, C, C++, Java
- Code execution via JDoodle API with STDIN support
- Output synchronized to all users in the session
- Typing indicators
- In-session team chat
- Download current file
- Toast notifications for user join/leave and language changes

## Prerequisites

- Node.js v14 or higher
- npm
- A free JDoodle API account (for code execution)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your JDoodle credentials in `server.js`:
   ```js
   const JDOODLE_CLIENT_ID = 'your_client_id';
   const JDOODLE_CLIENT_SECRET = 'your_client_secret';
   ```
   Get free credentials at [jdoodle.com/compiler-api](https://www.jdoodle.com/compiler-api/) (200 executions/day free).

3. Start the server:
   ```bash
   npm start
   ```

4. Open `http://localhost:3000` in your browser.

## Usage

**Host a session** — Click "Start Hosting", enter your name. Share the generated room ID with others.

**Join a session** — Enter the room ID and your name, click "Join Now".

**In the editor:**
- Code changes sync to all users instantly
- Select a language from the dropdown to switch (synced to all users)
- Enter any program input in the **stdin** panel below the editor
- Click **Run Code** — output appears for everyone
- Click the **chat icon** to open the team chat panel
- Click the **download icon** to save the current file locally

## Project Structure

```
├── server.js
├── package.json
├── public/
│   ├── index.html
│   └── editor.html
├── js/
│   ├── app.js
│   └── editor-monaco.js
├── css/
│   └── styles.css
└── docs/
    └── README.md
```

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JS
- **Editor**: Monaco Editor 0.45
- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **Code Execution**: JDoodle API

## Troubleshooting

**Server won't start** — Check that port 3000 is free and run `npm install`.

**Code not executing** — Verify JDoodle credentials in `server.js` are correct and that you haven't exceeded the daily limit.

**Users not syncing** — Confirm all users are on the same room ID and the server is running.
