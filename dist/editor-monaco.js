let socket;
let roomId;
let userName;
let monacoEditor;
let typingTimeout;
let isTyping = false;
let currentLanguage = 'python';
let isRemoteChange = false;
let chatOpen = false;
let chatUnreadCount = 0;
let stdinCollapsed = false;

const langExtensions = {
    python: 'py', javascript: 'js', c: 'c', cpp: 'cpp', java: 'java'
};

const codeTemplates = {
    python: `# Python code\nprint("Hello, World!")`,
    javascript: `// JavaScript code\nconsole.log("Hello, World!");`,
    c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`
};

const monacoLanguageMap = {
    python: 'python', javascript: 'javascript', c: 'c', cpp: 'cpp', java: 'java'
};

const languageSelect   = document.getElementById('languageSelect');
const runBtn           = document.getElementById('runBtn');
const roomIdText       = document.getElementById('roomIdText');
const copyRoomBtn      = document.getElementById('copyRoomBtn');
const usersList        = document.getElementById('usersList');
const outputContent    = document.getElementById('outputContent');
const outputStatusText = document.getElementById('outputStatusText');
const statusBadge      = document.getElementById('statusBadge');
const downloadBtn      = document.getElementById('downloadBtn');
const chatToggleBtn    = document.getElementById('chatToggleBtn');
const chatCloseBtn     = document.getElementById('chatCloseBtn');
const chatPanel        = document.getElementById('chatPanel');
const chatMessages     = document.getElementById('chatMessages');
const chatInput        = document.getElementById('chatInput');
const chatSendBtn      = document.getElementById('chatSendBtn');
const chatUnreadBadge  = document.getElementById('chatUnreadBadge');
const stdinInput       = document.getElementById('stdinInput');
const stdinToggleBtn   = document.getElementById('stdinToggleBtn');
const toastContainer   = document.getElementById('toastContainer');

function init() {
    roomId   = sessionStorage.getItem('roomId');
    userName = sessionStorage.getItem('userName');

    if (!roomId || !userName) {
        window.location.href = 'index.html';
        return;
    }

    roomIdText.textContent = roomId;

    initMonacoEditor();

    setTimeout(() => {
        socket = io('http://localhost:3000');
        socket.emit('join-room', { roomId, userName });
        setupSocketListeners();
        setupUIListeners();
    }, 500);
}

function initMonacoEditor() {
    window.MonacoEnvironment = {
        getWorkerUrl: function (moduleId, label) {
            if (label === 'json')       return 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/language/json/json.worker.min.js';
            if (label === 'css' || label === 'scss' || label === 'less') return 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/language/css/css.worker.min.js';
            if (label === 'html' || label === 'handlebars' || label === 'razor') return 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/language/html/html.worker.min.js';
            if (label === 'typescript' || label === 'javascript') return 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/language/typescript/ts.worker.min.js';
            return 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.worker.min.js';
        }
    };

    require(['vs/editor/editor.main'], function () {
        monacoEditor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
            value: codeTemplates[currentLanguage],
            language: monacoLanguageMap[currentLanguage],
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            minimap: { enabled: true },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            wordBasedSuggestions: true,
            parameterHints: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 4,
            insertSpaces: true
        });

        monacoEditor.onDidChangeModelContent(() => {
            if (!isRemoteChange && socket) {
                socket.emit('code-change', { roomId, code: monacoEditor.getValue() });

                if (!isTyping) {
                    isTyping = true;
                    socket.emit('typing-start', { roomId, userName });
                }
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    isTyping = false;
                    socket.emit('typing-stop', { roomId, userName });
                }, 1000);
            }
        });
    });
}

function setupSocketListeners() {
    socket.on('room-state', ({ code, language, users }) => {
        if (monacoEditor) {
            if (code) {
                isRemoteChange = true;
                monacoEditor.setValue(code);
                isRemoteChange = false;
            } else if (!monacoEditor.getValue().trim() && language) {
                isRemoteChange = true;
                monacoEditor.setValue(codeTemplates[language] || '');
                isRemoteChange = false;
            }
        }
        if (language) {
            currentLanguage = language;
            languageSelect.value = language;
            if (monacoEditor) {
                monaco.editor.setModelLanguage(monacoEditor.getModel(), monacoLanguageMap[language]);
            }
        }
        updateUsersList(users);
    });

    socket.on('user-joined', ({ userName: newUser, users }) => {
        updateUsersList(users);
        showToast(`👋 ${newUser} joined the session`, 'info');
    });

    socket.on('user-left', ({ userName: leftUser, users }) => {
        updateUsersList(users);
        showToast(`🚪 ${leftUser} left the session`, 'warning');
    });

    socket.on('code-update', ({ code }) => {
        if (monacoEditor) {
            const position = monacoEditor.getPosition();
            isRemoteChange = true;
            monacoEditor.setValue(code);
            monacoEditor.setPosition(position);
            isRemoteChange = false;
        }
    });

    socket.on('language-update', ({ language }) => {
        currentLanguage = language;
        languageSelect.value = language;
        if (monacoEditor) {
            monaco.editor.setModelLanguage(monacoEditor.getModel(), monacoLanguageMap[language]);
        }
        showToast(`🔧 Language changed to ${language.toUpperCase()}`, 'info');
    });

    socket.on('user-typing', ({ userName: typingUser, typing }) => {
        updateTypingStatus(typingUser, typing);
    });

    socket.on('output-update', ({ output, status, time, memory }) => {
        displayOutput({ output, status, time, memory });
    });

    socket.on('chat-message', ({ userName: sender, message, timestamp }) => {
        appendChatMessage(sender, message, timestamp, false);
        if (!chatOpen) {
            chatUnreadCount++;
            chatUnreadBadge.textContent = chatUnreadCount > 9 ? '9+' : chatUnreadCount;
            chatUnreadBadge.style.display = 'flex';
        }
    });
}

function setupUIListeners() {
    languageSelect.addEventListener('change', () => {
        const language = languageSelect.value;
        currentLanguage = language;
        if (monacoEditor) {
            isRemoteChange = true;
            monacoEditor.setValue(codeTemplates[language]);
            monaco.editor.setModelLanguage(monacoEditor.getModel(), monacoLanguageMap[language]);
            isRemoteChange = false;
            if (socket) {
                socket.emit('code-change', { roomId, code: codeTemplates[language] });
                socket.emit('language-change', { roomId, language });
            }
        }
    });

    runBtn.addEventListener('click', runCode);

    copyRoomBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(roomId).then(() => {
            const originalHTML = copyRoomBtn.innerHTML;
            copyRoomBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            setTimeout(() => { copyRoomBtn.innerHTML = originalHTML; }, 2000);
        });
    });

    downloadBtn.addEventListener('click', () => {
        if (!monacoEditor) return;
        const code = monacoEditor.getValue();
        const ext  = langExtensions[currentLanguage] || 'txt';
        const blob = new Blob([code], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `code.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`⬇️ Downloaded code.${ext}`, 'success');
    });

    chatToggleBtn.addEventListener('click', openChat);
    chatCloseBtn.addEventListener('click', () => {
        chatPanel.classList.remove('open');
        chatOpen = false;
    });
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    stdinToggleBtn.addEventListener('click', () => {
        stdinCollapsed = !stdinCollapsed;
        const panel = document.getElementById('stdinPanel');
        panel.classList.toggle('collapsed', stdinCollapsed);
        stdinToggleBtn.textContent = stdinCollapsed ? '▸' : '▾';
    });
}

function updateUsersList(users) {
    usersList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.username = user.userName;
        const initial = user.userName.charAt(0).toUpperCase();
        userItem.innerHTML = `
            <div class="user-avatar">${initial}</div>
            <div class="user-details">
                <div class="user-name">${user.userName}${user.userName === userName ? ' (You)' : ''}</div>
                <div class="user-status">Online</div>
            </div>
        `;
        usersList.appendChild(userItem);
    });
}

function updateTypingStatus(typingUser, typing) {
    const userItem = document.querySelector(`[data-username="${typingUser}"]`);
    if (userItem) {
        const statusEl = userItem.querySelector('.user-status');
        if (typing) {
            userItem.classList.add('typing');
            statusEl.textContent = 'typing...';
            statusEl.classList.add('typing-indicator');
        } else {
            userItem.classList.remove('typing');
            statusEl.textContent = 'Online';
            statusEl.classList.remove('typing-indicator');
        }
    }
}

async function runCode() {
    if (!monacoEditor) return;
    const code = monacoEditor.getValue().trim();
    if (!code) { alert('Please write some code first'); return; }

    const stdin = stdinInput.value;

    runBtn.disabled = true;
    runBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="30" stroke-dashoffset="0">
                <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="1s" repeatCount="indefinite"/>
            </circle>
        </svg>
        <span>Running...</span>
    `;
    outputStatusText.textContent = 'Executing...';
    statusBadge.className = 'status-badge running';
    statusBadge.textContent = 'RUNNING';
    statusBadge.style.display = 'inline-block';
    outputContent.innerHTML = '<div class="output-placeholder">Executing your code...</div>';

    try {
        const response = await fetch('http://localhost:3000/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language: currentLanguage, stdin })
        });
        const result = await response.json();
        displayOutput(result);

        if (socket) {
            socket.emit('output-sync', {
                roomId,
                output: result.output,
                status: result.status,
                time: result.time,
                memory: result.memory,
                error: result.error
            });
        }
    } catch (error) {
        outputContent.innerHTML = `<pre style="color:#f5576c;">Error: ${escapeHtml(error.message)}\n\nMake sure the server is running on http://localhost:3000</pre>`;
        statusBadge.className = 'status-badge error';
        statusBadge.textContent = 'ERROR';
        outputStatusText.textContent = 'Error';
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 2L12 8L4 14V2Z" fill="currentColor"/>
            </svg>
            <span>Run Code</span>
        `;
    }
}

function displayOutput(result) {
    if (result.error) {
        outputContent.innerHTML = `<pre style="color:#f5576c;">${escapeHtml(result.error)}</pre>`;
        statusBadge.className = 'status-badge error';
        statusBadge.textContent = 'ERROR';
        outputStatusText.textContent = 'Error';
    } else {
        outputContent.innerHTML = `<pre>${escapeHtml(result.output)}</pre>`;
        if (result.status && result.status.toLowerCase().includes('success')) {
            statusBadge.className = 'status-badge success';
            statusBadge.textContent = 'SUCCESS';
            outputStatusText.textContent = 'Success';
        } else {
            statusBadge.className = 'status-badge success';
            statusBadge.textContent = result.status || 'DONE';
            outputStatusText.textContent = result.status || 'Completed';
        }
        if (result.time || result.memory) {
            const stats = document.createElement('div');
            stats.style.cssText = 'margin-top:1rem;color:var(--text-secondary);font-size:0.85rem;';
            stats.innerHTML = `${result.time ? `⏱️ Time: ${result.time}s` : ''} ${result.memory ? `💾 Memory: ${result.memory}KB` : ''}`;
            outputContent.appendChild(stats);
        }
    }
    statusBadge.style.display = 'inline-block';
}

function openChat() {
    chatPanel.classList.add('open');
    chatOpen = true;
    chatUnreadCount = 0;
    chatUnreadBadge.style.display = 'none';
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendChatMessage(userName, message, timestamp, true);
    if (socket) {
        socket.emit('chat-message', { roomId, userName, message, timestamp });
    }
    chatInput.value = '';
}

function appendChatMessage(sender, message, timestamp, isSelf) {
    const div = document.createElement('div');
    div.className = `chat-msg ${isSelf ? 'self' : 'other'}`;
    div.innerHTML = `
        <div class="chat-msg-meta">
            <span class="chat-msg-user">${escapeHtml(sender)}</span>
            <span class="chat-msg-time">${timestamp}</span>
        </div>
        <div class="chat-msg-bubble">${escapeHtml(message)}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('beforeunload', () => {
    if (socket) socket.disconnect();
});

window.addEventListener('load', init);
