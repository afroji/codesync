// Landing page logic
let currentRoomId = '';
let currentAction = '';

const hostBtn = document.getElementById('hostBtn');
const joinBtn = document.getElementById('joinBtn');
const roomIdInput = document.getElementById('roomIdInput');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');

// Host session
hostBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/generate-room');
        const data = await response.json();
        currentRoomId = data.roomId;
        currentAction = 'host';

        roomIdDisplay.textContent = `Room ID: ${currentRoomId}`;
        roomIdDisplay.style.display = 'block';
        usernameModal.classList.add('active');
        usernameInput.focus();
    } catch (error) {
        alert('Failed to create room. Please make sure the server is running.');
        console.error(error);
    }
});

// Join session
joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim().toUpperCase();

    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }

    if (roomId.length !== 8) {
        alert('Room ID must be 8 characters');
        return;
    }

    currentRoomId = roomId;
    currentAction = 'join';

    roomIdDisplay.textContent = `Joining Room: ${currentRoomId}`;
    roomIdDisplay.style.display = 'block';
    usernameModal.classList.add('active');
    usernameInput.focus();
});

// Handle Enter key in room ID input
roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

// Handle Enter key in username input
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        confirmBtn.click();
    }
});

// Cancel modal
cancelBtn.addEventListener('click', () => {
    usernameModal.classList.remove('active');
    usernameInput.value = '';
    roomIdDisplay.style.display = 'none';
    currentRoomId = '';
    currentAction = '';
});

// Confirm and proceed to editor
confirmBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();

    if (!username) {
        alert('Please enter your name');
        return;
    }

    // Store session data and navigate to editor
    sessionStorage.setItem('roomId', currentRoomId);
    sessionStorage.setItem('userName', username);
    sessionStorage.setItem('action', currentAction);

    window.location.href = 'editor.html';
});

// Close modal on outside click
usernameModal.addEventListener('click', (e) => {
    if (e.target === usernameModal) {
        cancelBtn.click();
    }
});
