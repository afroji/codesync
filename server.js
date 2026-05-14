const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

app.use(express.static('public'));
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/docs', express.static('docs'));

const rooms = new Map();

const JDOODLE_API = 'https://api.jdoodle.com/v1/execute';
const JDOODLE_CLIENT_ID = '7d2feebfd883349ebfaf80659c73a8a4';
const JDOODLE_CLIENT_SECRET = '327d18e99ce7850fb7b813e4bcc0bdda0e376515db15b7bd3b1cc67f3e35f1e0';

const LANGUAGE_MAPPINGS = {
  'c': { language: 'c', versionIndex: '5' },
  'cpp': { language: 'cpp17', versionIndex: '1' },
  'java': { language: 'java', versionIndex: '4' },
  'python': { language: 'python3', versionIndex: '3' },
  'javascript': { language: 'nodejs', versionIndex: '4' }
};

app.get('/api/generate-room', (req, res) => {
  const roomId = uuidv4().substring(0, 8).toUpperCase();
  res.json({ roomId });
});

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, stdin } = req.body;
    const languageConfig = LANGUAGE_MAPPINGS[language];

    if (!languageConfig) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    if (JDOODLE_CLIENT_ID === 'YOUR_CLIENT_ID') {
      return res.status(503).json({
        error: 'JDoodle credentials not configured.',
        output: 'Code execution is not set up yet.',
        status: 'Not Configured'
      });
    }

    console.log(`Executing ${language} code via JDoodle API...`);

    const response = await axios.post(JDOODLE_API, {
      clientId: JDOODLE_CLIENT_ID,
      clientSecret: JDOODLE_CLIENT_SECRET,
      script: code,
      language: languageConfig.language,
      versionIndex: languageConfig.versionIndex,
      stdin: stdin || ''
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const result = response.data;
    console.log('JDoodle response:', result);

    const output = result.output || 'No output';
    const isError = result.statusCode && result.statusCode !== 200;

    res.json({
      output: output,
      status: isError ? 'Error' : 'Success',
      time: result.cpuTime || null,
      memory: result.memory || null,
      error: isError ? output : null
    });

  } catch (error) {
    console.error('Execution error:', error.response?.data || error.message);

    if (error.response) {
      return res.status(500).json({
        error: `API Error: ${error.response.data?.error || error.response.statusText}`,
        output: `Failed to execute code.\n\nError: ${JSON.stringify(error.response.data, null, 2)}`,
        status: 'Error'
      });
    }

    res.status(500).json({
      error: error.message,
      output: `Code execution failed.\n\nError: ${error.message}\n\nPlease check your internet connection and try again.`,
      status: 'Error'
    });
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        code: '',
        language: 'python'
      });
    }

    const room = rooms.get(roomId);
    room.users.set(socket.id, { userName, typing: false });

    socket.emit('room-state', {
      code: room.code,
      language: room.language,
      users: Array.from(room.users.values())
    });

    socket.to(roomId).emit('user-joined', {
      userName,
      users: Array.from(room.users.values())
    });

    console.log(`${userName} joined room ${roomId}`);
  });

  socket.on('code-change', ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.code = code;
      socket.to(roomId).emit('code-update', { code });
    }
  });

  socket.on('language-change', ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.language = language;
      socket.to(roomId).emit('language-update', { language });
    }
  });

  socket.on('typing-start', ({ roomId, userName }) => {
    const room = rooms.get(roomId);
    if (room && room.users.has(socket.id)) {
      room.users.get(socket.id).typing = true;
      socket.to(roomId).emit('user-typing', { userName, typing: true });
    }
  });

  socket.on('typing-stop', ({ roomId, userName }) => {
    const room = rooms.get(roomId);
    if (room && room.users.has(socket.id)) {
      room.users.get(socket.id).typing = false;
      socket.to(roomId).emit('user-typing', { userName, typing: false });
    }
  });

  socket.on('output-sync', ({ roomId, output, status, time, memory }) => {
    socket.to(roomId).emit('output-update', { output, status, time, memory });
  });

  socket.on('chat-message', ({ roomId, userName, message, timestamp }) => {
    socket.to(roomId).emit('chat-message', { userName, message, timestamp });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);

        socket.to(roomId).emit('user-left', {
          userName: user.userName,
          users: Array.from(room.users.values())
        });

        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
