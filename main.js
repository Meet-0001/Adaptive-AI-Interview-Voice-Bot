/**
 * main.js — InterviewMentor App Logic
 */

// ── State ─────────────────────────────────────────────────────
const state = {
  currentSessionId: null,
  currentRole: 'General',
  docs: [],           // { name, content }
  ttsEnabled: true,
  currentAudio: null,
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const welcomeScreen   = $('welcomeScreen');
const chatArea        = $('chatArea');
const chatMessages    = $('chatMessages');
const textInput       = $('textInput');
const sendBtn         = $('sendBtn');
const micBtn          = $('micBtn');
const micIcon         = $('micIcon');
const voiceStatus     = $('voiceStatus');
const voiceStatusText = $('voiceStatusText');
const sessionsList    = $('sessionsList');
const newSessionBtn   = $('newSessionBtn');
const startSessionBtn = $('startSessionBtn');
const topbarRole      = $('topbarRole');
const roleInput       = $('roleInput');
const uploadDocBtn    = $('uploadDocBtn');
const uploadModal     = $('uploadModal');
const modalClose      = $('modalClose');
const modalDone       = $('modalDone');
const uploadZone      = $('uploadZone');
const fileUpload      = $('fileUpload');
const uploadedFiles   = $('uploadedFiles');
const docBadges       = $('docBadges');
const statusDot       = $('statusDot');
const statusText      = $('statusText');
const clearChatBtn    = $('clearChatBtn');
const fileInputHidden = $('fileInputHidden');
const uploadZoneMini  = $('uploadZoneMini');

// ── Voice recorder ────────────────────────────────────────────
const recorder = new VoiceRecorder();

recorder.onStart = () => {
  micBtn.classList.add('recording');
  micIcon.textContent = '⏹';
  voiceStatus.classList.remove('hidden');
  voiceStatusText.textContent = 'Listening... Click mic to stop.';
};

recorder.onStop = () => {
  micBtn.classList.remove('recording');
  micIcon.textContent = '🎙';
  voiceStatus.classList.remove('hidden');
  voiceStatusText.textContent = 'Transcribing...';
};

recorder.onResult = (text) => {
  voiceStatus.classList.add('hidden');
  if (!text || text.startsWith('[')) {
    showToast('Could not transcribe. Try speaking again.');
    return;
  }
  textInput.value = text;
  autoResize(textInput);
  sendMessage();
};

recorder.onError = (err) => {
  voiceStatus.classList.add('hidden');
  micBtn.classList.remove('recording');
  micIcon.textContent = '🎙';
  showToast(err);
};

micBtn.addEventListener('click', () => {
  if (!state.currentSessionId) {
    showToast('Please start a session first.');
    return;
  }
  recorder.toggle();
});

// ── Ollama health check ───────────────────────────────────────
async function checkHealth() {
  try {
    const resp = await fetch('/api/health');
    const data = await resp.json();
    if (data.ollama) {
      statusDot.className = 'status-dot online';
      const model = data.models.find(m => m.includes('llama3.2')) || data.models[0] || 'llama3.2';
      statusText.textContent = `${model} ready`;
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Ollama offline';
    }
  } catch {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Server error';
  }
}

// ── Session management ────────────────────────────────────────
async function loadSessions() {
  try {
    const resp = await fetch('/api/sessions');
    const sessions = await resp.json();
    renderSessionsList(sessions);
  } catch {
    sessionsList.innerHTML = '<div class="sessions-empty">Could not load sessions.</div>';
  }
}

function renderSessionsList(sessions) {
  if (!sessions.length) {
    sessionsList.innerHTML = '<div class="sessions-empty">No sessions yet.<br/>Start a new interview!</div>';
    return;
  }
  sessionsList.innerHTML = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.id === state.currentSessionId ? ' active' : '');
    item.dataset.id = s.id;

    const date = new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' });
    item.innerHTML = `
      <div class="session-item-info">
        <div class="session-item-role">${escHtml(s.role)}</div>
        <div class="session-item-date">${date} · ${s.message_count || 0} msgs</div>
      </div>
      <button class="session-item-del" title="Delete session" data-id="${s.id}">✕</button>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('session-item-del')) return;
      loadSession(s.id);
    });
    item.querySelector('.session-item-del').addEventListener('click', () => deleteSession(s.id));
    sessionsList.appendChild(item);
  });
}

async function loadSession(id) {
  try {
    const resp = await fetch(`/api/sessions/${id}`);
    const data = await resp.json();

    state.currentSessionId = data.session.id;
    state.currentRole = data.session.role;

    showChatArea();
    topbarRole.textContent = `▶ ${data.session.role}`;
    chatMessages.innerHTML = '';

    data.messages.forEach(m => appendMessage(m.role, m.content, false));
    chatMessages.scrollTop = chatMessages.scrollHeight;

    updateActiveSession();
    await loadSessions();
  } catch {
    showToast('Could not load session.');
  }
}

async function deleteSession(id) {
  if (!confirm('Delete this session?')) return;
  try {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (state.currentSessionId === id) {
      state.currentSessionId = null;
      showWelcomeScreen();
    }
    loadSessions();
  } catch {
    showToast('Could not delete session.');
  }
}

function updateActiveSession() {
  document.querySelectorAll('.session-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === state.currentSessionId);
  });
}

// ── Start session ─────────────────────────────────────────────
newSessionBtn.addEventListener('click', () => {
  state.currentSessionId = null;
  showWelcomeScreen();
});

startSessionBtn.addEventListener('click', startSession);
roleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') startSession();
});

async function startSession() {
  const role = roleInput.value.trim() || 'General';
  state.currentRole = role;

  try {
    const resp = await fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await resp.json();
    state.currentSessionId = data.session_id;

    showChatArea();
    topbarRole.textContent = `▶ ${role}`;
    chatMessages.innerHTML = '';

    await loadSessions();
    updateActiveSession();

    // Send opening message
    await sendToAI(`Start a mock interview for the role: ${role}. Greet me and ask the first question.`);
  } catch {
    showToast('Could not start session. Is Flask running?');
  }
}

// ── Sending messages ──────────────────────────────────────────
sendBtn.addEventListener('click', sendMessage);
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
textInput.addEventListener('input', () => autoResize(textInput));

async function sendMessage() {
  const text = textInput.value.trim();
  if (!text || !state.currentSessionId) return;

  textInput.value = '';
  autoResize(textInput);
  await sendToAI(text);
}

async function sendToAI(userMessage, skipUserBubble = false) {
  if (!skipUserBubble) {
    appendMessage('user', userMessage);
  }

  sendBtn.disabled = true;
  const typingEl = appendTyping();

  // Build context from docs
  let fullMessage = userMessage;
  if (state.docs.length > 0) {
    const docContext = state.docs.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n');
    fullMessage = userMessage + `\n\n[CONTEXT DOCUMENTS]\n${docContext}`;
  }

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: state.currentSessionId,
        message: fullMessage,
        role: state.currentRole,
      }),
    });
    const data = await resp.json();

    typingEl.remove();
    sendBtn.disabled = false;

    const response = data.response || '[No response]';
    appendMessage('assistant', response);

    if (state.ttsEnabled) {
      playTTS(response);
    }

    await loadSessions();
  } catch (err) {
    typingEl.remove();
    sendBtn.disabled = false;
    appendMessage('assistant', '⚠ Could not reach server. Make sure Flask is running on port 5000.');
  }
}

// ── TTS ───────────────────────────────────────────────────────
async function playTTS(text) {
  try {
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio = null;
    }

    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) return;

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.currentAudio = audio;
    audio.play().catch(() => {});
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {
    // TTS errors are non-fatal
  }
}

// ── Message rendering ─────────────────────────────────────────
function appendMessage(role, content, scroll = true) {
  const isUser = role === 'user';
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;

  const initials = isUser ? 'YOU' : 'AI';
  msg.innerHTML = `
    <div class="msg-avatar">${initials}</div>
    <div class="msg-body">
      <div class="msg-name">${isUser ? 'You' : 'Mentor (Guy)'}</div>
      <div class="msg-bubble">${escHtml(content)}</div>
      <div class="msg-actions">
        ${!isUser ? `<button class="msg-action-btn" onclick="playTTS(${JSON.stringify(content)})">🔊 Play</button>` : ''}
        <button class="msg-action-btn" onclick="copyText(${JSON.stringify(content)})">📋 Copy</button>
      </div>
    </div>
  `;

  chatMessages.appendChild(msg);
  if (scroll) chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function appendTyping() {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-body">
      <div class="msg-name">Mentor (Guy)</div>
      <div class="msg-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

// ── Document upload ───────────────────────────────────────────
uploadDocBtn.addEventListener('click', () => uploadModal.classList.remove('hidden'));
modalClose.addEventListener('click', () => uploadModal.classList.add('hidden'));
modalDone.addEventListener('click', () => uploadModal.classList.add('hidden'));

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
});

fileUpload.addEventListener('change', e => handleFiles(e.target.files));
fileInputHidden.addEventListener('change', e => handleFiles(e.target.files));

uploadZoneMini.addEventListener('click', () => fileInputHidden.click());

async function handleFiles(files) {
  for (const file of files) {
    const content = await readFileText(file);
    if (!state.docs.find(d => d.name === file.name)) {
      state.docs.push({ name: file.name, content });
    }
  }
  renderUploadedFiles();
  renderDocBadges();
}

function readFileText(file) {
  return new Promise(res => {
    if (file.type === 'application/pdf') {
      res(`[PDF: ${file.name}] (Upload as .txt for best results)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = () => res('[Could not read file]');
    reader.readAsText(file);
  });
}

function renderUploadedFiles() {
  uploadedFiles.innerHTML = '';
  state.docs.forEach((doc, i) => {
    const el = document.createElement('div');
    el.className = 'uploaded-file';
    el.innerHTML = `
      <span class="uploaded-file-name">📄 ${escHtml(doc.name)}</span>
      <button class="uploaded-file-del" data-i="${i}">✕</button>
    `;
    el.querySelector('.uploaded-file-del').addEventListener('click', () => {
      state.docs.splice(i, 1);
      renderUploadedFiles();
      renderDocBadges();
    });
    uploadedFiles.appendChild(el);
  });
}

function renderDocBadges() {
  docBadges.innerHTML = '';
  state.docs.forEach((doc, i) => {
    const badge = document.createElement('div');
    badge.className = 'doc-badge';
    badge.innerHTML = `${escHtml(doc.name)} <button data-i="${i}">✕</button>`;
    badge.querySelector('button').addEventListener('click', () => {
      state.docs.splice(i, 1);
      renderDocBadges();
    });
    docBadges.appendChild(badge);
  });
}

// ── View helpers ──────────────────────────────────────────────
function showChatArea() {
  welcomeScreen.classList.add('hidden');
  chatArea.classList.remove('hidden');
}
function showWelcomeScreen() {
  chatArea.classList.add('hidden');
  welcomeScreen.classList.remove('hidden');
  topbarRole.textContent = 'No active session';
  updateActiveSession();
}

clearChatBtn.addEventListener('click', () => {
  if (!state.currentSessionId) return;
  if (confirm('Clear this chat display? (Session history in DB is kept)')) {
    chatMessages.innerHTML = '';
  }
});

// ── Utilities ─────────────────────────────────────────────────
function escHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
}

function showToast(msg) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%)',
      background: '#21262d', border: '1px solid #30363d',
      color: '#c9d1d9', padding: '10px 20px',
      borderRadius: '8px', fontSize: '13px',
      fontFamily: "'JetBrains Mono', monospace",
      zIndex: '9999', transition: 'opacity 0.3s',
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// Expose globals for inline onclick
window.playTTS = playTTS;
window.copyText = copyText;

// ── Init ──────────────────────────────────────────────────────
checkHealth();
setInterval(checkHealth, 30000);
loadSessions();