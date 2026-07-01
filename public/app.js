/* BoardroomCXO Content Engine — app.js */

const API_BASE = '/api';
const isProd = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
let passphrase = '';
let currentProfile = 'boardroomcxo';
let sessionId = null;
let chatState = 'idle'; // idle | brewing | awaiting_selection | generating | done

/* ── SESSION HISTORY ────────────────────────────────────────── */

const SESSION_STORE_KEY = 'bcxo_session_history';

function loadSessionHistory() {
  try { return JSON.parse(localStorage.getItem(SESSION_STORE_KEY) || '[]'); } catch { return []; }
}

function saveSessionToHistory(subject, profile, postText, scores) {
  const sessions = loadSessionHistory();
  const session = {
    id: 'sess_' + Date.now(),
    profile,
    subject,
    postText,
    scores,
    timestamp: new Date().toISOString(),
  };
  sessions.unshift(session);
  if (sessions.length > 20) sessions.length = 20;
  localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(sessions));
}

// Previous chats are read from the database (all posts ever generated, any device/browser)
// when running in production, with localStorage as the dev-only / offline fallback.
async function loadAllSessions() {
  if (isProd) {
    try {
      const res = await fetch(`${API_BASE}/posts`, { headers: apiHeaders() });
      if (!res.ok) throw new Error('Failed to load posts');
      const data = await res.json();
      const rows = (data.posts || []).filter(p => p.linkedin_post);
      return rows.map(r => ({
        id: r.id,
        profile: r.profile,
        subject: r.subject || (r.content_type === 'industry' ? 'Industry News' : 'Untitled'),
        timestamp: r.created_at,
        postText: r.linkedin_post,
        virality_score: r.virality_score,
        status: r.status,
        source: 'db',
      }));
    } catch {
      // Server unreachable — fall back to this browser's local history below
    }
  }
  return loadSessionHistory().map(s => ({ ...s, source: 'local' }));
}

async function showHistoryPanel() {
  const panel = document.getElementById('history-panel');
  const overlay = document.getElementById('history-overlay');
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  overlay.style.display = 'block';
  panel.style.display = 'flex';
  empty.style.display = 'none';
  list.style.display = 'block';
  list.innerHTML = '<div class="history-loading">Loading previous chats...</div>';

  const sessions = await loadAllSessions();

  list.innerHTML = '';
  if (!sessions.length) {
    empty.style.display = 'block';
    list.style.display = 'none';
  } else {
    empty.style.display = 'none';
    list.style.display = 'block';
    sessions.forEach(s => {
      const profileLabel = { boardroomcxo: 'BoardroomCXO', ketul: 'CA Ketul Patel' };
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-item-meta">
          <span class="history-item-profile">${profileLabel[s.profile] || s.profile}</span>
          <span class="history-item-date">${fmtDate(s.timestamp)}</span>
        </div>
        <div class="history-item-subject">${escHtml(s.subject)}</div>
        <div class="history-item-foot">
          ${s.virality_score != null ? `<span class="history-item-score">Virality ${s.virality_score}/100</span>` : '<span></span>'}
          <button class="history-item-load" data-id="${escHtml(s.id)}">Load in chat</button>
        </div>`;
      el.querySelector('.history-item-load').addEventListener('click', () => {
        hideHistoryPanel();
        loadSessionIntoChat(s);
      });
      list.appendChild(el);
    });
  }
}

function hideHistoryPanel() {
  document.getElementById('history-panel').style.display = 'none';
  document.getElementById('history-overlay').style.display = 'none';
}

function loadSessionIntoChat(session) {
  document.getElementById('chat-area').innerHTML = '';
  chatState = 'done';
  const profileLabel = { boardroomcxo: 'BoardroomCXO', ketul: 'CA Ketul Patel' };
  addBotMessage(`Loaded session: **${session.subject}** (${profileLabel[session.profile] || session.profile})`);

  const label = session.profile === 'boardroomcxo' ? 'LinkedIn Post — Leader Spotlight' : 'LinkedIn Post — Industry News';
  const scoreChips = session.scores || (session.virality_score != null ? [`Virality: ${session.virality_score}/100`] : []);

  // Restore lastGeneratedPost so copy/approve/regenerate work
  lastGeneratedPost = {
    post: session.postText,
    _profile: session.profile,
    _item: { label: session.subject },
    post_id: session.source === 'db' ? session.id : null,
  };

  showPostCard(label, session.postText, scoreChips, [
    { id: 'copy', label: 'Copy Text' },
    { id: 'regenerate', label: 'Regenerate' },
    { id: 'approve', label: 'Approve Post', primary: true },
  ]);

  addBotMessage('You can edit the post inline, copy it, or approve it to generate an image. Say "repurpose" to generate Instagram, WhatsApp, and Blog versions.');
}

/* ── UTILS ─────────────────────────────────────────── */

function apiHeaders() {
  return { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase };
}

function scrollChat() {
  const area = document.getElementById('chat-area');
  if (area) area.scrollTop = area.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/* ── LOGIN ──────────────────────────────────────────────────── */

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('login-input').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!input) return;

  const isProd = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

  if (isProd) {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        headers: { 'x-access-passphrase': input }
      });
      if (res.status === 401) {
        errEl.style.display = 'block';
        return;
      }
    } catch {
      errEl.textContent = 'Could not reach server. Please try again.';
      errEl.style.display = 'block';
      return;
    }
  }

  passphrase = input;
  enterApp();
});

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // Wire up history panel
  document.getElementById('history-btn').addEventListener('click', showHistoryPanel);
  document.getElementById('history-close').addEventListener('click', hideHistoryPanel);
  document.getElementById('history-overlay').addEventListener('click', hideHistoryPanel);

  // Apply saved default profile preference
  const savedPrefs = loadLocalPrefs();
  if (savedPrefs.defaultProfile && savedPrefs.defaultProfile !== 'boardroomcxo') {
    const opt = document.querySelector(`.profile-option[data-profile="${savedPrefs.defaultProfile}"]`);
    if (opt) {
      currentProfile = savedPrefs.defaultProfile;
      document.getElementById('profile-name').textContent = opt.dataset.label;
      document.getElementById('profile-sub').textContent = opt.dataset.sub;
      document.getElementById('profile-avatar').textContent = opt.dataset.label[0];
    }
  }

  initChat();
  checkCalendarReminders();
}

/* ── NAV ────────────────────────────────────────────────────── */

const panelInited = {};

document.querySelectorAll('.sidebar-item[data-nav]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const nav = el.dataset.nav;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${nav}`).classList.add('active');
    if (!panelInited[nav]) {
      panelInited[nav] = true;
      if (nav === 'prompts') initPromptsPanel();
      if (nav === 'calendar') initCalendarPanel();
      if (nav === 'performance') initPerformancePanel();
      if (nav === 'blacklist') initBlacklistPanel();
      if (nav === 'keywords') initKeywordsPanel();
      if (nav === 'preferences') initPreferencesPanel();
    }
  });
});

/* ── PROFILE SWITCHER ───────────────────────────────────────── */

document.getElementById('profile-pill').addEventListener('click', (e) => {
  e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.profile-option').forEach(el => {
  el.addEventListener('click', () => {
    currentProfile = el.dataset.profile;
    document.getElementById('profile-name').textContent = el.dataset.label;
    document.getElementById('profile-sub').textContent = el.dataset.sub;
    document.getElementById('profile-avatar').textContent = el.dataset.label[0];
    document.getElementById('profile-dropdown').style.display = 'none';
    updateProfileChip();
    resetChat();
  });
});

document.addEventListener('click', () => {
  document.getElementById('profile-dropdown').style.display = 'none';
});

function updateProfileChip() {
  const chip = document.getElementById('content-type-chip');
  if (currentProfile === 'boardroomcxo') chip.textContent = 'Leader Spotlight';
  
  else chip.textContent = 'Industry News';
}

/* ── CHAT ───────────────────────────────────────────────────── */

function initChat() {
  updateProfileChip();
  addBotMessage('Good to see you. Select your content profile in the bottom-left, then hit the brew button to start.');
}

function resetChat() {
  document.getElementById('chat-area').innerHTML = '';
  chatState = 'idle';
  sessionId = null;
  const profileLabel = { boardroomcxo: 'BoardroomCXO company page (Leader Spotlight)', ketul: 'CA Ketul Patel personal profile (Industry News)' };
  addBotMessage(`Profile switched to **${profileLabel[currentProfile] || currentProfile}**. Hit brew to begin a new session.`);
}

document.getElementById('brew-btn').addEventListener('click', startBrew);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addUserMessage(text);
  handleUserInput(text);
}

function addUserMessage(text) {
  const area = document.getElementById('chat-area');
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `<div class="msg-label">You</div><div class="msg-bubble user">${formatText(text)}</div>`;
  area.appendChild(row);
  scrollChat();
}

function addBotMessage(text) {
  const area = document.getElementById('chat-area');
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `<div class="msg-label">Content Engine</div><div class="msg-bubble bot">${formatText(text)}</div>`;
  area.appendChild(row);
  scrollChat();
  return row;
}

/* ── PROGRESS CARD ──────────────────────────────────────────── */

function showProgress(title, steps) {
  const area = document.getElementById('chat-area');
  const card = document.createElement('div');
  card.className = 'msg-row';

  const stepsHtml = steps.map((s, i) => `
    <div class="step-item" id="step-${i}">
      <div class="step-icon pending" id="step-icon-${i}"><i class="ti ti-circle"></i></div>
      <span class="step-label pending" id="step-label-${i}">${s}</span>
    </div>`).join('');

  card.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="progress-card" id="progress-card">
      <div class="progress-title">
        <span class="progress-live-dot"></span>
        ${title}
      </div>
      <div class="progress-working-hint" id="progress-hint">Working in the background — this takes 15 to 30 seconds...</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" id="progress-bar" style="width:0%"></div>
        <span class="progress-pct" id="progress-pct">0%</span>
      </div>
      <div class="step-list">${stepsHtml}</div>
    </div>`;
  area.appendChild(card);
  scrollChat();

  // After 10 seconds with no step change, show reassurance
  const reassureTimer = setTimeout(() => {
    const hint = card.querySelector('#progress-hint');
    if (hint) hint.textContent = 'Still working — AI calls can take up to 60 seconds. Please do not refresh.';
  }, 10000);
  card._reassureTimer = reassureTimer;

  return card;
}

function clearProgressReassure(card) {
  if (card && card._reassureTimer) clearTimeout(card._reassureTimer);
}

// NOTE: every lookup below is scoped to the specific `card` element returned
// by showProgress(), not document.getElementById(...). The step/bar ids are
// NOT unique across cards (each progress card reuses the same ids), so a
// document-wide lookup would silently hit whichever card was created first —
// which is exactly why later cards in a multi-step chat session (e.g. the
// post-generation card that appears after the shortlist card) used to stay
// frozen at 0%: every update was being applied to the earlier, already-done
// card instead.

function setStepActive(card, index, total) {
  const icon = card.querySelector(`#step-icon-${index}`);
  const label = card.querySelector(`#step-label-${index}`);
  if (!icon) return;
  icon.className = 'step-icon active';
  icon.innerHTML = '<div class="step-dot"></div>';
  label.className = 'step-label active';
  // Show at least 5% so user sees the bar has started
  const pct = Math.max(5, Math.round((index / total) * 100));
  const bar = card.querySelector('#progress-bar');
  const pctEl = card.querySelector('#progress-pct');
  if (bar) bar.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  scrollChat();
}

function setStepDone(card, index, total) {
  const icon = card.querySelector(`#step-icon-${index}`);
  const label = card.querySelector(`#step-label-${index}`);
  if (!icon) return;
  icon.className = 'step-icon done';
  icon.innerHTML = '<i class="ti ti-check"></i>';
  label.className = 'step-label done';
  const pct = Math.round(((index + 1) / total) * 100);
  const bar = card.querySelector('#progress-bar');
  const pctEl = card.querySelector('#progress-pct');
  if (bar) bar.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  scrollChat();
}

function finishProgress(card) {
  const bar = card.querySelector('#progress-bar');
  const pctEl = card.querySelector('#progress-pct');
  if (bar) bar.style.width = '100%';
  if (pctEl) pctEl.textContent = '100%';
  const hint = card.querySelector('#progress-hint');
  if (hint) hint.textContent = 'Done.';
}

// Sets the bar to an exact percentage, independent of step index — used when
// the backend reports continuous real progress (e.g. tokens streamed so far).
function setProgressPct(card, pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const bar = card.querySelector('#progress-bar');
  const pctEl = card.querySelector('#progress-pct');
  if (bar) bar.style.width = `${clamped}%`;
  if (pctEl) pctEl.textContent = `${clamped}%`;
  scrollChat();
}

/* ── OPTIONS CARD ───────────────────────────────────────────── */

function showOptions(header, items, onSelect) {
  const area = document.getElementById('chat-area');
  const card = document.createElement('div');
  card.className = 'msg-row';

  const rowsHtml = items.map((item, i) => `
    <div class="option-row" data-idx="${i}">
      <span class="option-name">${formatText(item.label)}</span>
      ${item.score !== undefined ? `<span class="option-score">${item.score}/100</span>` : ''}
    </div>`).join('');

  card.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="options-card">
      <div class="options-header">${header}</div>
      ${rowsHtml}
    </div>`;
  area.appendChild(card);

  card.querySelectorAll('.option-row').forEach(row => {
    row.addEventListener('click', () => {
      card.querySelectorAll('.option-row').forEach(r => r.style.pointerEvents = 'none');
      const idx = parseInt(row.dataset.idx);
      row.style.background = '#EEF1F7';
      row.style.borderColor = '#1B2B4B';
      onSelect(idx, items[idx]);
    });
  });

  scrollChat();
}

/* ── POST CARD ──────────────────────────────────────────────── */

function showPostCard(label, initialText, scores, actions) {
  const area = document.getElementById('chat-area');
  const card = document.createElement('div');
  card.className = 'msg-row';
  const uid = Date.now();

  // mutable reference so edit can update copy/approve
  let currentText = initialText;

  const scoresHtml = scores.map(s => `<span class="post-card-score">${s}</span>`).join('');
  const actionsHtml = actions.map(a =>
    `<button class="action-btn${a.primary ? ' primary' : ''}" data-action="${a.id}">${a.label}</button>`
  ).join('');

  card.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="post-card">
      <div class="post-card-label">${label}</div>
      <div class="post-card-text" id="pct-${uid}">${formatText(currentText)}</div>
      <textarea class="post-edit-area" id="pea-${uid}" style="display:none"></textarea>
      <div class="post-card-edit-bar">
        <button class="edit-toggle-btn" id="etb-${uid}"><i class="ti ti-pencil"></i> Edit</button>
      </div>
      <div class="post-card-meta">${scoresHtml}</div>
      <div class="post-card-actions">${actionsHtml}</div>
    </div>`;
  area.appendChild(card);

  // Edit toggle
  const displayEl = card.querySelector(`#pct-${uid}`);
  const taEl = card.querySelector(`#pea-${uid}`);
  const editBtn = card.querySelector(`#etb-${uid}`);
  let isEditing = false;

  editBtn.addEventListener('click', () => {
    if (!isEditing) {
      taEl.value = currentText;
      taEl.style.height = 'auto';
      taEl.style.height = Math.max(taEl.scrollHeight, 120) + 'px';
      displayEl.style.display = 'none';
      taEl.style.display = 'block';
      taEl.focus();
      editBtn.innerHTML = '<i class="ti ti-check"></i> Save';
      editBtn.classList.add('active');
      isEditing = true;
    } else {
      currentText = taEl.value;
      if (lastGeneratedPost) lastGeneratedPost.post = currentText;
      displayEl.innerHTML = formatText(currentText);
      taEl.style.display = 'none';
      displayEl.style.display = 'block';
      editBtn.innerHTML = '<i class="ti ti-pencil"></i> Edit';
      editBtn.classList.remove('active');
      isEditing = false;
    }
  });

  // Action buttons
  card.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'copy') {
        const textToCopy = (lastGeneratedPost?.post) || currentText;
        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy Text'; }, 2000);
        });
      } else if (action === 'approve') {
        btn.textContent = 'Saving...';
        btn.disabled = true;
        if (isProd && lastGeneratedPost?.post_id) {
          try {
            await fetch(`${API_BASE}/posts`, {
              method: 'PATCH',
              headers: apiHeaders(),
              body: JSON.stringify({ id: lastGeneratedPost.post_id, status: 'approved' }),
            });
          } catch { /* non-fatal */ }
        }
        btn.textContent = 'Approved';

        // Save to session history
        if (lastGeneratedPost) {
          const subject = lastGeneratedPost._item?.name || lastGeneratedPost._item?.label?.split(' — ')[0] || 'Untitled';
          saveSessionToHistory(subject, lastGeneratedPost._profile, lastGeneratedPost.post, scores);
        }

        addBotMessage('Post approved. Now let\'s set up the image — confirm the headline text and upload your photos below.');
        showHeadlineApprovalCard();
      } else if (action === 'regenerate') {
        if (!lastGeneratedPost) return;
        chatState = 'generating';
        card.querySelectorAll('.action-btn').forEach(b => b.disabled = true);
        addBotMessage('Regenerating post...');
        await runPostGeneration(lastGeneratedPost._profile, lastGeneratedPost._item);
      }
    });
  });

  scrollChat();
}

/* ── HEADLINE APPROVAL CARD (after post approval) ────────────── */

async function showHeadlineApprovalCard() {
  const area = document.getElementById('chat-area');

  // Derive smart defaults from post subject
  const item = lastGeneratedPost?._item || {};
  const rawLabel = item.label || item.name || '';
  const subjectName = rawLabel.split(' — ')[0] || '';
  const subjectTitle = rawLabel.split(' — ')[1] || '';
  const subjectLineDefault = subjectName + (subjectTitle ? ', ' + subjectTitle : '');

  // Loading state while headline options are scored
  const loadingCard = document.createElement('div');
  loadingCard.className = 'msg-row';
  loadingCard.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="headline-card">
      <div class="headline-card-title">Drafting headline options from your post...</div>
      <div class="headline-card-sub">Scoring each for virality — this takes a few seconds.</div>
    </div>`;
  area.appendChild(loadingCard);
  scrollChat();

  const headlineOptions = await getHeadlineOptions(lastGeneratedPost?.post || '', subjectLineDefault);
  loadingCard.remove();

  const card = document.createElement('div');
  card.className = 'msg-row';

  const optionsHtml = headlineOptions.map((opt, i) => `
    <label class="headline-option${i === 0 ? ' selected' : ''}" data-index="${i}">
      <input type="radio" name="hl-option" value="${i}" ${i === 0 ? 'checked' : ''} />
      <div class="headline-option-body">
        <div class="headline-option-top">
          <span class="headline-option-score score-${scoreTier(opt.virality_score)}">${opt.virality_score}/100</span>
        </div>
        <div class="headline-option-text">${escHtml(opt.headline)}</div>
        <div class="headline-option-note">${escHtml(opt.virality_note || '')}</div>
      </div>
    </label>`).join('');

  card.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="headline-card">
      <div class="headline-card-title">Step 1 — Choose your image headline</div>
      <div class="headline-card-sub">Five options, derived from your approved post and ranked by virality score. Pick one, then edit if you like.</div>
      <div class="headline-options">${optionsHtml}</div>
      <div class="headline-fields">
        <div class="upload-field-label">Headline (main text)</div>
        <input type="text" class="upload-field-input" id="hl-headline" placeholder="e.g. The question that changed everything" value="${escHtml(headlineOptions[0]?.headline || '')}" />
        <div class="upload-field-label">Accent word (shown in gold — must appear in headline)</div>
        <input type="text" class="upload-field-input" id="hl-accent" value="${escHtml(headlineOptions[0]?.accent_word || '')}" placeholder="e.g. changed" />
        <div class="upload-field-label">Subject line (name and title)</div>
        <input type="text" class="upload-field-input" id="hl-subject" placeholder="e.g. Madhabi Puri Buch, Chairperson, SEBI" value="${escHtml(subjectLineDefault)}" />
      </div>
      <div class="headline-actions">
        <button class="save-btn" id="hl-confirm-btn">Confirm &amp; Add Photos</button>
        <button class="action-btn" id="hl-skip-btn">Skip image, go to repurpose</button>
      </div>
    </div>`;

  area.appendChild(card);

  card.querySelectorAll('.headline-option').forEach(optEl => {
    optEl.addEventListener('click', () => {
      const idx = Number(optEl.dataset.index);
      const opt = headlineOptions[idx];
      card.querySelectorAll('.headline-option').forEach(o => o.classList.remove('selected'));
      optEl.classList.add('selected');
      optEl.querySelector('input[type="radio"]').checked = true;
      document.getElementById('hl-headline').value = opt.headline || '';
      document.getElementById('hl-accent').value = opt.accent_word || '';
    });
  });

  card.querySelector('#hl-confirm-btn').addEventListener('click', () => {
    const headline = document.getElementById('hl-headline').value.trim();
    const accent   = document.getElementById('hl-accent').value.trim();
    const subject  = document.getElementById('hl-subject').value.trim();
    if (!headline) { addBotMessage('Please enter a headline first.'); return; }
    card.remove();
    addBotMessage('Headline confirmed. Now upload the photos for the image.');
    showImageUploadCard(headline, accent, subject);
  });

  card.querySelector('#hl-skip-btn').addEventListener('click', () => {
    card.remove();
    if (lastGeneratedPost?.post) {
      runRepurpose(lastGeneratedPost._profile, lastGeneratedPost.post, lastGeneratedPost.post_id);
    }
  });

  scrollChat();
}

function scoreTier(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

async function getHeadlineOptions(postText, subjectLine) {
  if (isProd) {
    try {
      const res = await fetch(`${API_BASE}/headline`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ post_text: postText, subject: subjectLine }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (Array.isArray(data.headlines) && data.headlines.length) return data.headlines;
      throw new Error('No headlines returned');
    } catch {
      return demoHeadlineOptions(postText);
    }
  }
  await delay(700);
  return demoHeadlineOptions(postText);
}

// Local fallback used when the API is unreachable (or in dev without a DB/API key) —
// derives options from the actual post text rather than a fixed template.
const HEADLINE_STOPWORDS = new Set(['the', 'a', 'an', 'is', 'was', 'were', 'to', 'of', 'in', 'on', 'and', 'but', 'or', 'that', 'this', 'it', 'its', 'for', 'with', 'at', 'as', 'by', 'from', 'not', 'no', 'every', 'there', 'be', 'been']);

function demoHeadlineOptions(postText) {
  const firstLine = (postText || '').split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
  const words = firstLine.replace(/[.*_#]/g, '').split(' ').filter(Boolean);
  const hook = words.slice(0, 7).join(' ') || 'A different kind of leadership move';
  const accentCandidate = words
    .filter(w => !HEADLINE_STOPWORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')))
    .sort((a, b) => b.length - a.length)[0] || words[words.length - 1] || 'different';

  return [
    { headline: hook, accent_word: accentCandidate, virality_score: 86, virality_note: 'Opens with the post\'s own hook line — highest recall' },
    { headline: 'The move nobody saw coming', accent_word: 'nobody', virality_score: 79, virality_note: 'Curiosity gap — strong scroll-stop power' },
    { headline: 'One decision. A category redefined.', accent_word: 'redefined', virality_score: 74, virality_note: 'Short, declarative, magazine-cover rhythm' },
    { headline: 'She built what nobody believed in', accent_word: 'believed', virality_score: 70, virality_note: 'Emotional resonance, but less specific to this post' },
    { headline: 'The bet that rewrote the rules', accent_word: 'rewrote', virality_score: 65, virality_note: 'Familiar phrasing — lower novelty' },
  ];
}

/* ── BREW FLOW ───────────────────────────────────────────────── */

async function startBrew() {
  if (chatState !== 'idle') return;
  chatState = 'brewing';
  document.getElementById('brew-btn').disabled = true;

  if (currentProfile === 'boardroomcxo') {
    await runLeaderSpotlightFlow();
  } else {
    await runIndustryNewsFlow();
  }
}

/* ── LEADER SPOTLIGHT FLOW ───────────────────────────────────── */

async function runLeaderSpotlightFlow() {
  const steps = [
    'Loading exclusion list from database',
    'Scanning past preferences',
    'Generating 5 leader shortlist',
    'Scoring virality for each option',
    'Ready for your selection'
  ];
  const progressCard = showProgress('Building Leader Shortlist...', steps);

  setStepActive(progressCard, 0, steps.length);
  await delay(300);

  let options;

  if (isProd) {
    const tickInterval = animateSteps(progressCard, steps, 1, steps.length - 1, 800);
    try {
      const res = await fetch(`${API_BASE}/research`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ profile: 'boardroomcxo' }),
      });
      clearInterval(tickInterval);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      options = data.options;
    } catch (err) {
      clearInterval(tickInterval);
      chatState = 'idle';
      document.getElementById('brew-btn').disabled = false;
      addBotMessage(`Research failed: ${err.message}. Please try again.`);
      return;
    }
    for (let i = 0; i < steps.length; i++) setStepDone(progressCard, i, steps.length);
    finishProgress(progressCard);
  } else {
    await delay(500); setStepDone(progressCard, 0, steps.length); setStepActive(progressCard, 1, steps.length);
    await delay(600); setStepDone(progressCard, 1, steps.length); setStepActive(progressCard, 2, steps.length);
    await delay(900); setStepDone(progressCard, 2, steps.length); setStepActive(progressCard, 3, steps.length);
    await delay(700); setStepDone(progressCard, 3, steps.length); setStepActive(progressCard, 4, steps.length);
    await delay(400); setStepDone(progressCard, 4, steps.length); finishProgress(progressCard);
    options = [
      { label: 'Madhabi Puri Buch — SEBI Chairperson, capital markets reform', score: 88 },
      { label: 'Peyush Bansal — Lenskart, D2C vision to global retail', score: 84 },
      { label: 'Leena Nair — Chanel CEO, Indian roots, global luxury leadership', score: 81 },
      { label: 'Nithin Kamath — Zerodha, building trust in a low-trust category', score: 79 },
      { label: 'Falguni Nayar — Nykaa, IPO journey and founder resilience', score: 76 },
    ];
  }

  addBotMessage('Here are your top 5 leaders for this session. Click one to generate the post.');
  showOptions('Select a leader', options, onLeaderSelected);
  chatState = 'awaiting_selection';
}

async function onLeaderSelected(idx, item) {
  chatState = 'generating';
  const name = item.name || item.label.split(' — ')[0];
  addUserMessage(name);
  selectedItem = item;
  await runPostGeneration('boardroomcxo', item);
}

/* ── INDUSTRY NEWS FLOW ──────────────────────────────────────── */

async function runIndustryNewsFlow() {
  const prefs = loadLocalPrefs();
  const freshnessDays = prefs.articleFreshness || 25;

  const steps = [
    `Searching verified sources (last ${freshnessDays} days)`,
    'Filtering by story type and relevance',
    'Scoring virality and insight potential',
    'Deep analysis of top candidates',
    'Building shortlist of 5'
  ];
  const progressCard = showProgress('Researching Industry News...', steps);

  setStepActive(progressCard, 0, steps.length);
  await delay(300);

  let options;

  if (isProd) {
    const tickInterval = animateSteps(progressCard, steps, 1, steps.length - 1, 1200);
    try {
      const res = await fetch(`${API_BASE}/research`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ profile: currentProfile === 'boardroomcxo' ? 'boardroomcxo' : 'ketul', max_age_days: freshnessDays }),
      });
      clearInterval(tickInterval);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      options = data.options;
    } catch (err) {
      clearInterval(tickInterval);
      chatState = 'idle';
      document.getElementById('brew-btn').disabled = false;
      addBotMessage(`Research failed: ${err.message}. Please try again.`);
      return;
    }
    for (let i = 0; i < steps.length; i++) setStepDone(progressCard, i, steps.length);
    finishProgress(progressCard);
  } else {
    await delay(600); setStepDone(progressCard, 0, steps.length); setStepActive(progressCard, 1, steps.length);
    await delay(800); setStepDone(progressCard, 1, steps.length); setStepActive(progressCard, 2, steps.length);
    await delay(700); setStepDone(progressCard, 2, steps.length); setStepActive(progressCard, 3, steps.length);
    await delay(900); setStepDone(progressCard, 3, steps.length); setStepActive(progressCard, 4, steps.length);
    await delay(500); setStepDone(progressCard, 4, steps.length); finishProgress(progressCard);
    options = [
      { label: 'Myntra x Masaba collab — limited edition drops, community-led fashion', score: 86 },
      { label: 'Amitabh Bachchan launches personal D2C brand — celebrity brand play', score: 83 },
      { label: 'Reliance Retail acquires luxury distribution rights for India', score: 80 },
      { label: 'Kapiva raises Series C — Ayurveda D2C funding surge continues', score: 77 },
      { label: 'MamaEarth enters South East Asia — Indian brand going global', score: 74 },
    ];
  }

  addBotMessage(`Here are 5 verified articles from the last ${freshnessDays} days. Click one to generate the post.`);
  showOptions('Select a story', options, onStorySelected);
  chatState = 'awaiting_selection';
}

async function onStorySelected(idx, item) {
  chatState = 'generating';
  const name = item.brand || item.label.split(' — ')[0];
  addUserMessage(name);
  selectedItem = item;
  await runPostGeneration(currentProfile === 'boardroomcxo' ? 'boardroomcxo' : 'ketul', item);
}

/* ── POST GENERATION ─────────────────────────────────────────── */

let selectedItem = null;
let lastGeneratedPost = null;

async function runPostGeneration(profile, item) {
  const isLeader = profile === 'boardroomcxo';
  // One real step: the backend generates the whole post in a single streamed
  // model call, so there's no genuine separate "researching" / "quality check"
  // stage to report — the bar tracks real tokens streamed back, not a timer.
  const steps = [isLeader ? 'Generating Leader Spotlight post' : 'Writing Industry News post'];

  const progressCard = showProgress(
    isLeader ? 'Generating Leader Spotlight post...' : 'Writing Industry News post...',
    steps
  );

  if (isProd) {
    setStepActive(progressCard, 0, steps.length);
    let data;
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ profile, item }),
      });
      if (!res.ok) throw new Error(await res.text());
      data = await readNdjsonStream(res, (evt) => {
        if (evt.stage === 'generating') {
          // ~4 chars/token is a rough estimate; real signal is the actual
          // character count streamed back from Claude so far, not a timer.
          const estimatedChars = evt.max_tokens * 4;
          setProgressPct(progressCard, Math.min(95, (evt.chars / estimatedChars) * 100));
        }
      });
    } catch (err) {
      chatState = 'idle';
      document.getElementById('brew-btn').disabled = false;
      addBotMessage(`Post generation failed: ${err.message}. Please try again.`);
      return;
    }
    setStepDone(progressCard, 0, steps.length);
    finishProgress(progressCard);
    renderPostResult(profile, item, data);
  } else {
    for (let i = 0; i < steps.length; i++) {
      setStepActive(progressCard, i, steps.length);
      await delay(900 + Math.random() * 400);
      setStepDone(progressCard, i, steps.length);
    }
    finishProgress(progressCard);

    const itemName = item.name || item.brand || item.label.split(' — ')[0];
    const demoData = isLeader
      ? {
          post: `There is a moment every category creates for itself....\n\nA moment when the rules that built it stop working. When the players who followed them longest find themselves most exposed.\n\n${itemName} saw that moment coming before most people in the industry admitted it existed.\n\nNot because of better data. Because of a different question.\n\nWhile peers were asking how to protect share, this leader was asking what the category would look like if it started from scratch today. And then building that version before anyone else did.\n\nThe result was not a pivot. It was a redesign.\n\nRevenue moved. But more than revenue moved. The way the category thinks about itself moved. The people who compete in it had to rethink their assumptions.\n\nThat is a different kind of win than a quarterly number.\n\nMost leaders in consumer India optimise for the cycle they are in. Very few build for the cycle that is coming.\n\nThe ones who do tend to look prescient in hindsight. They were not prescient. They were just asking a different question earlier.\n\n#BoardroomCXO #LeaderSpotlight #IndianCXO #ConsumerIndia #ExecutiveSearch`,
          word_count: 187,
          virality_score: 84,
          seo_score: 78,
          aeo_score: 74,
          plagiarism: 'Clean',
          virality_note: 'Hook strength — the "different question" frame stops scrolling',
          virality_suggestion: 'Add one specific number from the leader\'s tenure to raise factual density',
          persona_panel: {
            average: 81,
            recommendation: 'Post as-is',
            consensus: 'Strong POV, clean contrast structure, closing lands well',
            debate: 'Sarthak wanted a harder number; CMO Titan felt the sector hook could be tighter',
          },
        }
      : {
          post: `${itemName} just made a move that most people in this industry will underestimate....\n\nI have seen this pattern before. A brand does something that looks like a marketing decision. It is actually a distribution decision. Or a positioning decision. Or a signal about where the category is heading.\n\nThis one is the third type.\n\nWhat happened on the surface: a launch, a collab, a funding round. What actually happened underneath: a bet on which consumer cohort is going to define this category in the next three years.\n\nI know founders who have been watching this space for a decade. Their read on this is unanimous. The brands that understand their customer\'s identity, not just their purchase behaviour, are the ones building something durable.\n\nThe ones chasing GMV are building something for the next two quarters.\n\nThe difference shows up slowly. Then all at once.\n\nWhat signal are you watching in your category right now?\n\n#BoardroomCXO #D2CIndia #ConsumerBrands #IndiaRetail #BrandStrategy`,
          word_count: 173,
          virality_score: 82,
          seo_score: 76,
          aeo_score: 71,
          plagiarism: 'Clean',
          voice_gate: 'Pass',
          virality_note: "POV clarity — 'identity vs purchase behaviour' distinction is specific and defensible",
          virality_suggestion: 'Name the specific brand move in line 2 rather than keeping it abstract',
          persona_panel: {
            average: 79,
            recommendation: 'Post with one specific change',
            consensus: 'Voice is distinctly Ketul, closing engagement trigger is strong',
            debate: 'CMO Titan wanted the news anchor to be more specific in the first paragraph',
          },
        };

    lastGeneratedPost = demoData;
    lastGeneratedPost._profile = profile;
    lastGeneratedPost._item = item;
    renderPostResult(profile, item, demoData);
  }
}

function renderPostResult(profile, item, data) {
  const isLeader = profile === 'boardroomcxo';
  lastGeneratedPost = { ...data, _profile: profile, _item: item };

  const label = isLeader ? 'LinkedIn Post — Leader Spotlight' : 'LinkedIn Post — Industry News';

  const scores = isLeader
    ? [
        `Virality: ${data.virality_score}/100`,
        `SEO: ${data.seo_score}/100`,
        `AEO: ${data.aeo_score}/100`,
        `Plagiarism: ${data.plagiarism}`,
      ]
    : [
        `Virality: ${data.virality_score}/100`,
        `SEO+AEO: ${data.seo_score}/100`,
        `Voice: ${data.voice_gate || 'Pass'}`,
        `Plagiarism: ${data.plagiarism}`,
      ];

  if (data.persona_panel?.average) {
    scores.push(`Panel Avg: ${data.persona_panel.average}/100`);
  }

  showPostCard(label, data.post, scores, [
    { id: 'copy', label: 'Copy Text' },
    { id: 'regenerate', label: 'Regenerate' },
    { id: 'approve', label: 'Approve Post', primary: true },
  ]);

  const panel = data.persona_panel;
  const panelMsg = panel
    ? `Panel verdict: **${panel.recommendation}**\nConsensus: ${panel.consensus}\n${panel.debate ? `Debate: ${panel.debate}` : ''}`
    : '';

  addBotMessage(
    `Post ready. ${panelMsg ? panelMsg + '\n\n' : ''}You can **edit the post inline** using the Edit button. Approve to save, copy to use directly, or say "regenerate" for a new version.`
  );

  chatState = 'done';
  document.getElementById('brew-btn').disabled = false;
  document.getElementById('brew-btn').textContent = 'Brew another post';
}

/* ── REPURPOSE FLOW ──────────────────────────────────────────── */

async function runRepurpose(profile, postText, postId) {
  chatState = 'generating';
  const steps = [
    'Reading finalised LinkedIn post',
    'Writing Instagram caption',
    'Writing WhatsApp Community message',
    'Writing Website Blog post',
    'Building SEO metadata and FAQs'
  ];
  const progressCard = showProgress('Repurposing content for all channels...', steps);

  if (isProd) {
    const tickInterval = animateSteps(progressCard, steps, 0, steps.length - 1, 4000);
    try {
      const res = await fetch(`${API_BASE}/repurpose`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ profile, post_text: postText, post_id: postId }),
      });
      clearInterval(tickInterval);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      for (let i = 0; i < steps.length; i++) setStepDone(progressCard, i, steps.length);
      finishProgress(progressCard);
      renderRepurposeResult(data);
    } catch (err) {
      clearInterval(tickInterval);
      chatState = 'done';
      addBotMessage(`Repurposing failed: ${err.message}. Please try again.`);
    }
  } else {
    for (let i = 0; i < steps.length; i++) {
      setStepActive(progressCard, i, steps.length);
      await delay(800 + Math.random() * 400);
      setStepDone(progressCard, i, steps.length);
    }
    finishProgress(progressCard);

    renderRepurposeResult({
      instagram: {
        caption: `She did not climb the ladder.\n\nShe redesigned it.\n\nFrom a small town to the C-suite of one of the world's most iconic brands... the path was never straight.\n\nBut it was always intentional.\n\nWhat separates the leaders who build something lasting from those who just manage what is already there?\n\nIt is not talent. It is the question they ask.\n\nMost ask: how do I protect what we have?\n\nThe rare ones ask: what would this look like if we started from scratch today?\n\nThat is the difference between a career and a legacy.\n\nFollow @boardroomcxo for stories of leaders who built differently.`,
        hashtags: '#LeaderSpotlight #BoardroomCXO #IndianCXO #D2CIndia #WomenInLeadership #ExecutiveSearch #IndianLeaders #ConsumerBrands #StartupIndia #LeadershipIndia',
      },
      whatsapp: {
        message: `*A story worth 2 minutes of your time.*\n\nMost leaders ask: how do I protect what we have?\n\nThe rare ones ask: what would this look like if we built it from scratch today?\n\nKey facts:\n- 30+ year career across multiple industries\n- Led one of the most recognised brand transformations in Indian consumer markets\n- Proved that homegrown leaders can outperform external hires at the highest level\n\nThe ones who build for the next cycle... always look prescient in hindsight. They are not. They are just asking a different question earlier.`,
      },
      blog: {
        seo_title: 'Madhabi Puri Buch: Transforming Capital Markets in India',
        meta_description: 'How SEBI Chairperson Madhabi Puri Buch applied a founder\'s mindset to regulatory leadership — a case study in executive leadership India.',
        og_title: 'The Question That Separates Good Leaders from Great Ones',
        introduction: `In Indian business, there are leaders who manage cycles and leaders who redesign them. Madhabi Puri Buch belongs to the second category...\n\nAs Chairperson of SEBI, she inherited an institution and turned it into a signal. Not through announcements or press releases, but through a consistent pattern of decisions that asked a different question than her predecessors.\n\nThis is the story of that question, and what it produced.`,
        body_sections: [
          { h2: 'The Situation Before', content: 'Capital markets in India had grown significantly through the 2010s. But regulatory infrastructure had not kept pace with market complexity. The gap was visible to insiders. What was less visible was what could be done about it, and who would do it.' },
          { h2: 'The Turning Point', content: 'The defining moment was not a single event. It was a philosophy made operational. Where most regulatory leaders asked how to enforce existing rules more effectively, this leader asked what the rules should look like if they were designed today for the markets that exist today.\n\nThat distinction sounds subtle. Its effects were not.' },
          { h2: 'What She Did Differently', content: 'Most leaders in that position optimise for the cycle they are in. She optimised for the cycle coming next.\n\nThe result was not a policy change. It was a shift in how the institution thought about its own purpose.' },
          { h2: 'What This Means for Consumer Brand Leadership in India', content: 'The leaders who will define Indian consumer brands in the next decade are asking the same question right now.\n\nNot: how do we protect our category share? But: what would this category look like if it started from scratch today?\n\nThe brands and companies that find and retain those leaders will not look prescient. They will just have hired earlier.' },
        ],
        closing: 'The question that separates legacy-builders from cycle-managers is not about resources or access. It is about the frame. Madhabi Puri Buch built a frame for an institution. The leaders who do the same for consumer brands in India will define the next decade of the category.',
        cta_block: 'At BoardroomCXO, we work with consumer, D2C, jewellery, and fashion brands across India and the UAE to find and place senior leaders who can drive this kind of transformation. If you are building a leadership team or looking for your next CXO role, [reach out to us].',
        faqs: [
          { question: 'Who is Madhabi Puri Buch and what is she known for?', answer: 'Madhabi Puri Buch is the Chairperson of SEBI, India\'s capital markets regulator. She is known for bringing a founder-like mindset to regulatory leadership, prioritising structural reform over incremental enforcement across Indian financial markets.' },
          { question: 'What makes a great regulatory or institutional leader in India?', answer: 'The most effective institutional leaders in India distinguish themselves by asking what a system should look like if designed from scratch, rather than optimising existing structures. This forward-framing approach has been a defining trait of leaders who drive lasting change.' },
        ],
        metadata: {
          seo_title: 'Madhabi Puri Buch: Transforming Capital Markets in India',
          meta_description: 'How SEBI Chairperson Madhabi Puri Buch applied a founder\'s mindset to regulatory leadership — a case study in executive leadership India.',
          primary_keyword: 'executive leadership India',
          secondary_keywords: ['SEBI Chairperson', 'capital markets India', 'senior leadership India', 'CXO hiring India'],
          image_alt_text: 'Madhabi Puri Buch, SEBI Chairperson, featured in BoardroomCXO Leader Spotlight on capital markets leadership in India',
          suggested_internal_links: ['What great FMCG leadership looks like in India', 'How BoardroomCXO places senior leaders in D2C brands', 'The homegrown leader advantage in Indian consumer businesses'],
          suggested_external_links: ['SEBI official press releases on regulatory changes', 'Economic Times coverage of capital markets reforms 2024-25'],
          schema_type: 'Article',
          estimated_reading_time: '4 minutes',
        },
      },
    });
  }
}

function renderRepurposeResult(data) {
  const area = document.getElementById('chat-area');
  const row = document.createElement('div');
  row.className = 'msg-row';

  const blog = data.blog || {};
  const insta = data.instagram || {};
  const wa = data.whatsapp || {};

  const bodySections = (blog.body_sections || []).map(s =>
    `<div class="blog-h2">${s.h2}</div><div class="repurpose-text" style="margin-top:4px">${formatText(s.content)}</div>`
  ).join('');

  const faqs = (blog.faqs || []).map(f =>
    `<div class="blog-faq"><div class="blog-faq-q">${f.question}</div><div class="blog-faq-a">${f.answer}</div></div>`
  ).join('');

  const meta = blog.metadata || {};
  const metaBlock = `
    <div><strong>SEO Title:</strong> ${meta.seo_title || ''}</div>
    <div><strong>Meta Description:</strong> ${meta.meta_description || ''}</div>
    <div><strong>Primary Keyword:</strong> ${meta.primary_keyword || ''}</div>
    <div><strong>Secondary Keywords:</strong> ${(meta.secondary_keywords || []).join(', ')}</div>
    <div><strong>Image Alt Text:</strong> ${meta.image_alt_text || ''}</div>
    <div><strong>Reading Time:</strong> ${meta.estimated_reading_time || ''}</div>
    <div><strong>Schema Type:</strong> ${meta.schema_type || 'Article'}</div>
    ${(meta.suggested_internal_links || []).length ? `<div><strong>Internal Links:</strong> ${meta.suggested_internal_links.join(' | ')}</div>` : ''}
    ${(meta.suggested_external_links || []).length ? `<div><strong>External Links:</strong> ${meta.suggested_external_links.join(' | ')}</div>` : ''}
  `.trim();

  row.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="repurpose-card">
      <div class="repurpose-tabs">
        <div class="repurpose-tab active" data-tab="instagram">Instagram</div>
        <div class="repurpose-tab" data-tab="whatsapp">WhatsApp</div>
        <div class="repurpose-tab" data-tab="blog">Blog</div>
      </div>

      <div class="repurpose-pane active" id="pane-instagram">
        <div class="repurpose-label">Instagram Caption</div>
        <div class="repurpose-text">${formatText(insta.caption || '')}</div>
        ${insta.hashtags ? `<div class="repurpose-meta">${insta.hashtags}</div>` : ''}
        <div class="repurpose-actions">
          <button class="action-btn" data-copy-instagram>Copy Caption</button>
        </div>
      </div>

      <div class="repurpose-pane" id="pane-whatsapp">
        <div class="repurpose-label">WhatsApp Community Message</div>
        <div class="repurpose-text">${formatText(wa.message || '')}</div>
        <div class="repurpose-actions">
          <button class="action-btn" data-copy-whatsapp>Copy Message</button>
        </div>
      </div>

      <div class="repurpose-pane" id="pane-blog">
        <div class="repurpose-label">Website Blog Post</div>
        <div class="blog-section">
          <div class="blog-h1">${blog.seo_title || ''}</div>
          <div class="repurpose-meta">Meta: ${blog.meta_description || ''}</div>
          <div class="repurpose-text">${formatText(blog.introduction || '')}</div>
          ${bodySections}
          ${blog.closing ? `<div class="repurpose-text">${formatText(blog.closing)}</div>` : ''}
          ${blog.cta_block ? `<div class="repurpose-text" style="border-left:3px solid #C9A84C;padding-left:10px">${formatText(blog.cta_block)}</div>` : ''}
          ${faqs ? `<div class="repurpose-label" style="margin-top:10px">FAQ Section</div>${faqs}` : ''}
          ${metaBlock ? `<div class="repurpose-label" style="margin-top:10px">SEO Metadata</div><div class="blog-meta-block">${metaBlock}</div>` : ''}
        </div>
        <div class="repurpose-actions">
          <button class="action-btn" data-copy-blog>Copy Blog</button>
          <button class="action-btn" data-copy-meta>Copy Metadata</button>
        </div>
      </div>
    </div>`;

  area.appendChild(row);

  row.querySelectorAll('.repurpose-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      row.querySelectorAll('.repurpose-tab').forEach(t => t.classList.remove('active'));
      row.querySelectorAll('.repurpose-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      row.querySelector(`#pane-${tab.dataset.tab}`).classList.add('active');
    });
  });

  const copyBtn = (selector, getText) => {
    row.querySelector(`[${selector}]`)?.addEventListener('click', (e) => {
      navigator.clipboard.writeText(getText()).then(() => {
        const orig = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = orig; }, 2000);
      });
    });
  };

  copyBtn('data-copy-instagram', () => `${insta.caption || ''}\n\n${insta.hashtags || ''}`);
  copyBtn('data-copy-whatsapp', () => wa.message || '');
  copyBtn('data-copy-blog', () => {
    const sections = (blog.body_sections || []).map(s => `## ${s.h2}\n\n${s.content}`).join('\n\n');
    const faqText = (blog.faqs || []).map(f => `### ${f.question}\n\n${f.answer}`).join('\n\n');
    return [blog.seo_title, blog.introduction, sections, blog.closing, blog.cta_block, faqText].filter(Boolean).join('\n\n');
  });
  copyBtn('data-copy-meta', () => metaBlock.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

  scrollChat();
  addBotMessage('All three versions are ready. Switch between tabs to review Instagram, WhatsApp, and Blog. Copy each one directly to your clipboard.');
  chatState = 'done';
}

/* ── STEP ANIMATION HELPER ───────────────────────────────────── */

function animateSteps(card, steps, fromIdx, toIdx, intervalMs) {
  let current = fromIdx;
  setStepActive(card, current, steps.length);
  const id = setInterval(() => {
    setStepDone(card, current, steps.length);
    current++;
    if (current <= toIdx) setStepActive(card, current, steps.length);
    else clearInterval(id);
  }, intervalMs);
  return id;
}

// Reads a newline-delimited JSON event stream from the backend and invokes
// onEvent for each parsed event as it arrives — this is what drives *real*
// progress (as opposed to animateSteps, which is a blind timer). Resolves
// with the payload of the terminal {stage:'complete', result} event.
async function readNdjsonStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  let errorMessage = null;

  const processLine = (line) => {
    if (!line.trim()) return;
    let evt;
    try { evt = JSON.parse(line); } catch { return; }
    onEvent(evt);
    if (evt.stage === 'complete') result = evt.result;
    if (evt.stage === 'error') errorMessage = evt.message;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(processLine);
  }
  if (buffer) processLine(buffer);

  if (errorMessage) throw new Error(errorMessage);
  if (!result) throw new Error('Stream ended without a result');
  return result;
}

/* ── IMAGE UPLOAD FLOW ───────────────────────────────────────── */

const LOGO_STORE_KEY = 'bcxo_stored_logos';

function loadStoredLogos() {
  try { return JSON.parse(localStorage.getItem(LOGO_STORE_KEY) || '{}'); } catch { return {}; }
}

function saveStoredLogo(slotKey, dataUrl) {
  const logos = loadStoredLogos();
  logos[slotKey] = dataUrl;
  localStorage.setItem(LOGO_STORE_KEY, JSON.stringify(logos));
}

function clearStoredLogo(slotKey) {
  const logos = loadStoredLogos();
  delete logos[slotKey];
  localStorage.setItem(LOGO_STORE_KEY, JSON.stringify(logos));
}

function showImageUploadCard(headline, accentWord, subjectLine) {
  const area = document.getElementById('chat-area');
  const card = document.createElement('div');
  card.className = 'msg-row';
  card.id = 'image-upload-row';

  const storedLogos = loadStoredLogos();

  function slotZoneHtml(key, label, required, isPersonPhoto) {
    const stored = storedLogos[key];
    const reqBadge = required ? '<span class="slot-required">required</span>' : '<span class="slot-optional">optional</span>';
    const previewHtml = stored
      ? `<img class="slot-preview-img" src="${stored}" /><div class="slot-stored-label">Saved — click to change</div>`
      : (isPersonPhoto
          ? `<div class="slot-upload-text"><strong>Click to upload</strong> (JPG or PNG)</div>`
          : `<div class="slot-upload-text"><strong>Click to upload</strong> logo (PNG)</div>`);
    return `
      <div class="upload-slot" data-slot="${key}">
        <div class="slot-label">${label} ${reqBadge}</div>
        <div class="slot-zone ${stored ? 'has-stored' : ''}" id="zone-${key}">
          <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none" id="file-${key}" />
          ${previewHtml}
        </div>
        ${stored ? `<button class="slot-clear-btn" data-clear="${key}">Remove saved</button>` : ''}
      </div>`;
  }

  card.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="upload-card">
      <div class="upload-card-title">Step 2 — Upload images</div>
      <div class="upload-card-sub">Person photos are uploaded fresh each time. Logos are saved and reused automatically.</div>

      <div class="upload-slots-grid">
        ${slotZoneHtml('person1', 'Person photo', true, true)}
        ${slotZoneHtml('person2', 'Person photo 2 (if featuring two people)', false, true)}
        ${slotZoneHtml('bcxo_logo', 'BoardroomCXO logo', false, false)}
        ${slotZoneHtml('logo1', 'Logo slot 1', false, false)}
        ${slotZoneHtml('logo2', 'Logo slot 2', false, false)}
        ${slotZoneHtml('logo3', 'Logo slot 3', false, false)}
        ${slotZoneHtml('logo4', 'Logo slot 4', false, false)}
      </div>

      <div class="upload-hidden-fields" style="display:none">
        <input type="text" id="img-headline" value="${escHtml(headline || '')}" />
        <input type="text" id="img-accent" value="${escHtml(accentWord || '')}" />
        <input type="text" id="img-subject-line" value="${escHtml(subjectLine || '')}" />
      </div>

      <button class="upload-submit-btn" id="upload-submit-btn" disabled>Generate Image</button>
    </div>`;

  area.appendChild(card);
  scrollChat();

  // Wire up each slot zone
  const slotKeys = ['person1', 'person2', 'bcxo_logo', 'logo1', 'logo2', 'logo3', 'logo4'];
  const isPersonSlot = key => key.startsWith('person');
  const fileCache = {};

  slotKeys.forEach(key => {
    const zone = card.querySelector(`#zone-${key}`);
    const fileInput = card.querySelector(`#file-${key}`);
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        fileCache[key] = file;
        zone.innerHTML = `<img class="slot-preview-img" src="${dataUrl}" /><div class="slot-stored-label">Ready</div>`;
        zone.classList.add('has-stored');

        // Persist logos (not person photos) to localStorage
        if (!isPersonSlot(key)) {
          saveStoredLogo(key, dataUrl);
          // Update or add clear button
          let clearBtn = card.querySelector(`[data-clear="${key}"]`);
          if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.className = 'slot-clear-btn';
            clearBtn.dataset.clear = key;
            clearBtn.textContent = 'Remove saved';
            zone.parentNode.appendChild(clearBtn);
            clearBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              clearStoredLogo(key);
              delete fileCache[key];
              zone.innerHTML = `<input type="file" accept="image/jpeg,image/png,image/webp" style="display:none" id="file-${key}" /><div class="slot-upload-text"><strong>Click to upload</strong> logo (PNG)</div>`;
              zone.classList.remove('has-stored');
              clearBtn.remove();
              card.querySelector(`#file-${key}`).addEventListener('change', fileInput.onchange);
              checkUploadReady();
            });
          }
        }
        checkUploadReady();
      };
      reader.readAsDataURL(file);
    });
  });

  // Wire up clear buttons for pre-stored logos
  card.querySelectorAll('.slot-clear-btn').forEach(btn => {
    const key = btn.dataset.clear;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearStoredLogo(key);
      delete fileCache[key];
      const zone = card.querySelector(`#zone-${key}`);
      if (zone) {
        zone.innerHTML = `<input type="file" accept="image/jpeg,image/png,image/webp" style="display:none" id="file-${key}" /><div class="slot-upload-text"><strong>Click to upload</strong> logo (PNG)</div>`;
        zone.classList.remove('has-stored');
        zone.addEventListener('click', () => zone.querySelector('input[type=file]').click());
        zone.querySelector('input[type=file]').addEventListener('change', function() {
          const file = this.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            fileCache[key] = file;
            saveStoredLogo(key, ev.target.result);
            zone.innerHTML = `<img class="slot-preview-img" src="${ev.target.result}" /><div class="slot-stored-label">Ready</div>`;
            zone.classList.add('has-stored');
            checkUploadReady();
          };
          reader.readAsDataURL(file);
        });
      }
      btn.remove();
      checkUploadReady();
    });
  });

  function checkUploadReady() {
    const hasPersonPhoto = !!(fileCache['person1']);
    document.getElementById('upload-submit-btn').disabled = !hasPersonPhoto;
  }

  // Pre-load stored logos into fileCache as data URLs for sending
  slotKeys.filter(k => !isPersonSlot(k)).forEach(key => {
    if (storedLogos[key]) {
      fileCache[key] = storedLogos[key]; // store dataUrl directly for non-person slots
    }
  });

  document.getElementById('upload-submit-btn').addEventListener('click', () => {
    const personFile = fileCache['person1'];
    if (!personFile) return;
    // Read values BEFORE removing card (card contains the hidden inputs)
    const headline = card.querySelector('#img-headline')?.value || '';
    const accent   = card.querySelector('#img-accent')?.value || '';
    const subject  = card.querySelector('#img-subject-line')?.value || '';
    if (!headline) { addBotMessage('Headline text is required before generating the image. Please go back and confirm the headline.'); return; }
    card.remove();
    runImagePipeline(personFile, fileCache, headline, accent, subject);
  });
}

// Maps a real backend pipeline event to a monotonically increasing overall
// percentage. Each retry attempt (up to 3) gets its own budget slice, so the
// bar never regresses even though the pipeline can loop back through
// generate/quality-check on a retry.
function imagePipelinePct(evt) {
  const perAttempt = 25;
  const attemptBase = 20 + (Math.max(1, evt.attempt || 1) - 1) * perAttempt;
  const key = `${evt.stage}:${evt.status}`;
  switch (key) {
    case 'analyse_photo:start': return 5;
    case 'analyse_photo:done': return 20;
    case 'generate_image:start': return attemptBase + 5;
    case 'generate_image:done': return attemptBase + 15;
    case 'quality_check:start': return attemptBase + 18;
    case 'quality_check:done': return Math.min(95, attemptBase + perAttempt);
    default: return null;
  }
}

async function runImagePipeline(personFile, allFiles, headline, accentWord, subjectLine) {
  chatState = 'generating';

  const steps = [
    'Analysing reference photo (GPT-4o Vision)',
    'Generating editorial image',
    'Running quality check (GPT-4o Vision)',
    'Delivering best result'
  ];
  const progressCard = showProgress('Generating post image...', steps);

  if (isProd) {
    setStepActive(progressCard, 0, steps.length);
    try {
      const formData = new FormData();
      formData.append('photo', personFile);
      if (allFiles.person2 instanceof File) formData.append('photo2', allFiles.person2);
      formData.append('post_text', lastGeneratedPost?.post || '');
      formData.append('headline', headline);
      formData.append('accent_word', accentWord);
      formData.append('subject_line', subjectLine);
      if (lastGeneratedPost?.post_id) formData.append('post_id', lastGeneratedPost.post_id);
      // Send stored logo data
      ['bcxo_logo','logo1','logo2','logo3','logo4'].forEach(k => {
        if (allFiles[k]) formData.append(k, allFiles[k] instanceof File ? allFiles[k] : allFiles[k]);
      });

      const res = await fetch(`${API_BASE}/image`, {
        method: 'POST',
        headers: { 'x-access-passphrase': passphrase },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());

      const data = await readNdjsonStream(res, (evt) => {
        if (evt.stage === 'analyse_photo') {
          if (evt.status === 'start') setStepActive(progressCard, 0, steps.length);
          else setStepDone(progressCard, 0, steps.length);
        } else if (evt.stage === 'generate_image') {
          const label = progressCard.querySelector('#step-label-1');
          if (label) label.textContent = evt.attempt > 1
            ? `Generating editorial image (attempt ${evt.attempt} of 3)`
            : 'Generating editorial image';
          if (evt.status === 'start') setStepActive(progressCard, 1, steps.length);
          else setStepDone(progressCard, 1, steps.length);
        } else if (evt.stage === 'quality_check') {
          if (evt.status === 'start') setStepActive(progressCard, 2, steps.length);
          else setStepDone(progressCard, 2, steps.length);
        }

        // setStepActive/setStepDone above compute the bar from step index,
        // which regresses on a retry — overwrite with the real monotonic pct.
        const pct = imagePipelinePct(evt);
        if (pct !== null) setProgressPct(progressCard, pct);
      });

      setStepActive(progressCard, 3, steps.length);
      setStepDone(progressCard, 3, steps.length);
      finishProgress(progressCard);
      renderImageResult(data);
    } catch (err) {
      chatState = 'done';
      addBotMessage(`Image generation failed: ${err.message}. Please try again.`);
    }
  } else {
    for (let i = 0; i < steps.length; i++) {
      setStepActive(progressCard, i, steps.length);
      await delay(1000 + Math.random() * 500);
      setStepDone(progressCard, i, steps.length);
    }
    finishProgress(progressCard);

    renderImageResult({
      image_url: null,
      attempt: 1,
      quality_score: 87,
      quality_report: {
        face_match: { status: 'Pass', points: 22, max: 25, note: 'Strong facial structure match' },
        skin_realism: { status: 'Pass', points: 13, max: 15, note: 'Natural texture, minor smoothing detected' },
        shadow_depth: { status: 'Pass', points: 9, max: 10, note: 'Soft directional shadow present' },
        clothing_accuracy: { status: 'Pass', points: 9, max: 10, note: 'Suit colour and collar consistent' },
        background_quality: { status: 'Pass', points: 10, max: 10, note: 'Clean charcoal gradient, no props' },
        lighting_quality: { status: 'Pass', points: 9, max: 10, note: 'Directional studio light, natural' },
        text_area: { status: 'Pass', points: 9, max: 10, note: 'Bottom fade clean, editorial feel' },
        logo_placeholder_zones: { status: 'Pass', points: 5, max: 5, note: 'Both zones clearly reserved' },
        overall_editorial_feel: { status: 'Pass', points: 1, max: 5, note: 'Slight AI artifact visible in background' },
      },
      limitations_notice: 'Note: DALL-E 3 generates images from text descriptions. The subject\'s face will be close but not pixel-perfect. Logo zones must be composited manually in Canva or Figma.',
      _dev: true,
    });
  }
}

function renderImageResult(data) {
  const area = document.getElementById('chat-area');
  const card = document.createElement('div');
  card.className = 'msg-row';

  const score = data.quality_score || 0;
  const report = data.quality_report || {};
  const passCount = Object.values(report).filter(c => c.status === 'Pass').length;
  const totalChecks = Object.keys(report).length;

  const checksHtml = Object.entries(report).map(([key, c]) => {
    const label = key.replace(/_/g, ' ');
    const cls = c.status === 'Pass' ? 'pass' : 'fail';
    return `<span class="image-card-score ${cls}">${c.status === 'Pass' ? '✓' : '✗'} ${label} ${c.points}/${c.max}</span>`;
  }).join('');

  const imgHtml = data.image_url
    ? `<img class="image-card-img" src="${data.image_url}" alt="Generated post image" />`
    : `<div style="background:#1B2B4B;border-radius:6px;height:200px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:12px;">${data._dev ? 'Image preview (dev mode — real image generated on Cloudflare)' : 'Image not available'}</div>`;

  card.innerHTML = `
    <div class="msg-label">Content Engine</div>
    <div class="image-card">
      <div class="image-card-label">Generated Image — Attempt ${data.attempt} of 3 — Score ${score}/100</div>
      ${imgHtml}
      <div class="image-card-scores">${checksHtml}</div>
      <div class="image-card-notice">${data.limitations_notice}</div>
      <div class="image-card-actions">
        ${data.image_url ? `<button class="action-btn primary" id="download-img-btn">Download Image</button>` : ''}
        <button class="action-btn" id="regen-img-btn">Regenerate Image</button>
      </div>
    </div>`;

  area.appendChild(card);

  if (data.image_url) {
    document.getElementById('download-img-btn')?.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = data.image_url;
      a.download = 'boardroomcxo-post-image.png';
      a.click();
    });
  }

  document.getElementById('regen-img-btn')?.addEventListener('click', () => {
    card.remove();
    addBotMessage('Upload a reference photo to generate a new image.');
    showHeadlineApprovalCard();
  });

  scrollChat();
  addBotMessage(`Image ready. ${passCount}/${totalChecks} quality checks passed (${score}/100). Download it, then composite the logos in Canva or Figma. Say "repurpose" to generate Instagram, WhatsApp, and Blog versions next.`);
  chatState = 'done';

  // Save to calendar after image is generated
  addToCalendarAfterImage(data);
}

function addToCalendarAfterImage(imageData) {
  if (!lastGeneratedPost) return;
  const CALENDAR_STORE_KEY = 'bcxo_calendar_entries';
  try {
    const entries = JSON.parse(localStorage.getItem(CALENDAR_STORE_KEY) || '[]');
    const subject = lastGeneratedPost._item?.label?.split(' — ')[0] || lastGeneratedPost._item?.name || 'Untitled';
    const entry = {
      id: lastGeneratedPost.post_id || ('local_' + Date.now()),
      profile: lastGeneratedPost._profile,
      subject,
      status: 'approved',
      virality_score: lastGeneratedPost.virality_score || null,
      created_at: new Date().toISOString(),
      scheduled_date: null,
      image_ready: true,
    };
    // Remove any existing entry for same post
    const filtered = entries.filter(e => e.id !== entry.id);
    filtered.unshift(entry);
    if (filtered.length > 50) filtered.length = 50;
    localStorage.setItem(CALENDAR_STORE_KEY, JSON.stringify(filtered));
  } catch { /* non-fatal */ }
}

/* ── FREE-TEXT INPUT HANDLER ────────────────────────────────── */

function handleUserInput(text) {
  const lower = text.toLowerCase();

  if (chatState === 'idle') {
    addBotMessage('Hit the brew button to start generating content.');
    return;
  }

  if (lower.includes('regenerate') || lower.includes('try again') || lower.includes('another version')) {
    if (lastGeneratedPost) {
      chatState = 'generating';
      addBotMessage('Regenerating post...');
      runPostGeneration(lastGeneratedPost._profile, lastGeneratedPost._item);
    } else {
      addBotMessage('Nothing to regenerate yet. Brew a post first.');
    }
    return;
  }

  if (lower.includes('generate image') || lower.includes('image')) {
    if (chatState === 'done') {
      addBotMessage('Let\'s set up the image headline first.');
      showHeadlineApprovalCard();
    } else {
      addBotMessage('Approve a post first, then say "generate image".');
    }
    return;
  }

  if (lower.includes('repurpose') || lower.includes('instagram') || lower.includes('whatsapp') || lower.includes('blog')) {
    if (lastGeneratedPost?.post) {
      runRepurpose(lastGeneratedPost._profile, lastGeneratedPost.post, lastGeneratedPost.post_id);
    } else {
      addBotMessage('Approve a post first, then say "repurpose".');
    }
    return;
  }

  if (chatState === 'done' && lastGeneratedPost?.post) {
    // Treat as an edit instruction for the current post
    handlePostEdit(text);
    return;
  }

  addBotMessage('Got it. Use the options above to select, or hit brew to start fresh.');
}

/* ── POST EDIT BY CHAT ──────────────────────────────────────── */

async function handlePostEdit(instruction) {
  chatState = 'generating';
  const thinkingRow = addBotMessage('Applying your edit...');

  if (isProd) {
    try {
      const res = await fetch(`${API_BASE}/edit`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ post: lastGeneratedPost.post, instruction }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      lastGeneratedPost.post = data.post;
      thinkingRow.querySelector('.msg-bubble').innerHTML = formatText('Edit applied. Here is the updated post:');
      showPostCard(
        lastGeneratedPost._profile === 'boardroomcxo' ? 'LinkedIn Post — Leader Spotlight (Edited)' : 'LinkedIn Post — Industry News (Edited)',
        data.post,
        [],
        [
          { id: 'copy', label: 'Copy Text' },
          { id: 'regenerate', label: 'Regenerate' },
          { id: 'approve', label: 'Approve Post', primary: true },
        ]
      );
    } catch (err) {
      thinkingRow.querySelector('.msg-bubble').innerHTML = formatText(`Edit failed: ${err.message}. Please try again.`);
    }
    chatState = 'done';
  } else {
    // Dev mode: simulate a minor edit with a note
    await delay(1200);
    const original = lastGeneratedPost.post;
    // Simulate the instruction being applied by appending a note
    const edited = original + `\n\n[Edit applied: "${instruction}" — this is a demo. In production, Claude rewrites the post based on your instruction.]`;
    lastGeneratedPost.post = edited;
    thinkingRow.querySelector('.msg-bubble').innerHTML = formatText('Edit applied (demo mode — in production Claude will rewrite based on your instruction). Here is the updated post:');
    showPostCard(
      lastGeneratedPost._profile === 'boardroomcxo' ? 'LinkedIn Post — Leader Spotlight (Edited)' : 'LinkedIn Post — Industry News (Edited)',
      edited,
      [],
      [
        { id: 'copy', label: 'Copy Text' },
        { id: 'regenerate', label: 'Regenerate' },
        { id: 'approve', label: 'Approve Post', primary: true },
      ]
    );
    chatState = 'done';
  }
}

/* ── HELPERS ────────────────────────────────────────────────── */

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ═══════════════════════════════════════════════════════════════
   MODULE 6 — SETTINGS PANELS
   ═══════════════════════════════════════════════════════════════ */

/* ── PROMPTS PANEL ──────────────────────────────────────────── */

const PROMPT_DEFS = [
  {
    key: 'prompt_leadership',
    label: 'Leader Spotlight Post (BoardroomCXO page)',
    desc: 'System prompt used when generating a Leader Spotlight LinkedIn post for the BoardroomCXO company page.',
    demo: `You are a LinkedIn content engine for BoardroomCXO, an executive search firm founded by CA Ketul Patel. The firm specialises in placing senior leadership talent across D2C, jewellery, fashion, and consumer brands in India and the UAE.

OBJECTIVE: Write a Leader Spotlight LinkedIn post for the BoardroomCXO company page. Each post features a real Indian business leader who has transformed a company, turned around a business, driven a major change, or shaped a category.

VOICE: Company-page register. We/us/our. Never first-person singular. Never "I". Audience: Founders, MDs, CXOs, CHROs, investors in Indian consumer, D2C, jewellery, and fashion businesses.

POST STRUCTURE:
1. Hook — 1 to 2 lines. The most surprising or counterintuitive thing about the leader's story. Not the bio, the moment beneath it.
2. Context — 2 to 3 sentences. What was the situation before. Set the stakes.
3. The insight — 3 to 5 sentences. The specific decision, question, or move that changed things. What they did that nobody else was doing.
4. The outcome — 1 to 2 sentences. What actually happened as a result. Specific if possible.
5. The broader truth — 2 to 3 sentences. What this means for leadership or hiring in India right now.
6. Closing line — 1 line. Standalone. Invites reflection or engagement.
7. Hashtags — 5 to 8. Always include #BoardroomCXO #LeaderSpotlight. Rest contextual.

WRITING RULES:
- No em dashes anywhere. Use commas or full stops instead.
- Ellipsis (...) must appear at least once — at a natural pause, not randomly.
- No banned words: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, transformative, pivotal, visionary, ecosystem (unless quoting).
- Never start with "I" or the leader's name.
- Every claim must be verifiable. No fabricated facts.
- Word count: 180 to 220 words for post body.
- Tone: Authoritative, intelligent, editorial. Reads like a business journalist wrote it, not a content agency.

QUALITY CHECKS (run after writing, report scores):
1. Virality score (0-100) — hook strength, scroll-stop power, share potential
2. SEO score (0-100) — keyword density, search relevance
3. AEO score (0-100) — structured clarity, likely to appear in AI answers
4. Plagiarism check — Claude's judgment: Clean / Review needed
5. Brand voice check — Pass / Fail against the voice rules above

PERSONA PANEL (run after quality checks):
Simulate three expert perspectives and report a combined verdict:
- CA Sarthak Ahuja (finance content creator) — does this land for a financially literate audience?
- CMO of Titan (senior FMCG exec) — is this relevant and credible for a sector CXO?
- Brand Manager at H&M India (consumer brand lens) — does this feel fresh and shareable?
Report: average panel score, recommendation (post as-is / minor change / rework), consensus, and any debate between panellists.`
  },
  {
    key: 'prompt_industry_post',
    label: 'Industry News Post (CA Ketul Patel profile)',
    desc: 'System prompt used when generating a LinkedIn post for CA Ketul Patel\'s personal profile.',
    demo: `You are a LinkedIn post writer for CA Ketul Patel — Chartered Accountant, entrepreneur, and founder active in India's D2C, jewellery, fashion, and luxury consumer brand ecosystem.

Your task: Turn a selected news article or brand story into a LinkedIn post that sounds exactly like Ketul — a smart, well-connected insider who has something worth saying about what just happened in his industry.

WHO KETUL IS: CA by training, founder by instinct. He operates inside the D2C, jewellery, fashion, and luxury consumer brand ecosystem as a participant, not an observer. First-person. Direct. Never corporate. Opinionated but grounded. Conversational — like a sharp message from a well-connected peer.

WHAT EVERY POST MUST DO:
1. Acknowledge the news — named brand, named person, concrete action. One to two sentences max.
2. Add Ketul's angle — what this signals beyond the headline. The CA lens, the founder lens, the market pattern.
3. Connect to the audience's reality — why does this matter to a founder, CMO, or investor right now?
4. Close with a thought that invites a response — not a yes/no question. Something that rewards genuine engagement.

POST STRUCTURE:
Hook (1-2 lines) | News anchor (1-2 sentences) | Ketul's take (2-4 sentences) | Ground truth (1-3 sentences) | Closing thought (1-2 lines)

WRITING RULES:
- First-person voice throughout (I, my, we when referring to his practice).
- No em dashes. Ellipsis (...) must appear at least once.
- No banned words: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, transformative, pivotal, visionary.
- Never fabricate facts not in the source article.
- Word count: 150 to 180 words.
- End with 5-8 hashtags. Always include #BoardroomCXO. Rest contextual to the story.`
  },
  {
    key: 'prompt_repurpose',
    label: 'Repurpose Prompt (Instagram, WhatsApp, Blog)',
    desc: 'System prompt used when repurposing a LinkedIn post into Instagram, WhatsApp, and Blog versions.',
    demo: `You are a content repurposing engine for BoardroomCXO. You receive a finalised LinkedIn post and produce three platform-specific versions.

GENERAL RULES (all three versions):
- Base output strictly on the LinkedIn post provided. No hallucination.
- Retain the core idea, message, and intent.
- Language must be human-like and conversational. Never AI-sounding.
- Ellipsis (...) must appear in every version. Mandatory.
- Zero em dashes anywhere. Strictly prohibited.

VERSION 1 — INSTAGRAM CAPTION:
Audience: Gen Z professionals, young leaders, students interested in business and leadership.
- Open with a scroll-stopping hook. First line does all the heavy lifting.
- Short and crisp. Every line earns its place.
- Use relevant emojis sparingly.
- Break lines intentionally for rhythm.
- End with: Follow @boardroomcxo for stories of leaders who built differently.
- Include 10 hashtags. Always include #LeaderSpotlight #BoardroomCXO. Rest contextual.

VERSION 2 — WHATSAPP COMMUNITY MESSAGE:
Audience: Mix of younger and older professionals in a community group.
- Feels like a real message from a real person in a real group. Warm, not branded.
- Use *bold* for opening headline (WhatsApp formatting).
- Bullet points for key facts.
- Keep it concise — only the most relevant content.
- No closing CTA or follow prompt. End after the last content point.

VERSION 3 — WEBSITE BLOG POST:
Audience: Founders, MDs, CHROs, CXOs, investors in Indian consumer/D2C/jewellery/fashion. High-intelligence readers.
Structure: SEO Title (H1, 55-60 chars) | Meta Description (150-160 chars) | OG Title | Introduction (150-200 words) | Body Sections (3-5 H2 sections, 700-900 words total) | Closing (80-100 words) | BoardroomCXO CTA Block | FAQ Section (3-4 FAQs for AEO/featured snippets) | SEO Metadata Block.
Voice: Editorial third-person. Simple clear sentences. No jargon.
Banned words: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, transformative, pivotal, visionary.
Zero em dashes. Ellipsis must appear at least once in intro and once in body.`
  },
  {
    key: 'prompt_image',
    label: 'Image Generation Prompt (DALL-E 3 pipeline)',
    desc: 'System prompt used when generating the post image via GPT-4o Vision + DALL-E 3 pipeline.',
    demo: `You are the BoardroomCXO Image Generation Engine. You run a three-stage pipeline: GPT-4o Vision analysis → DALL-E 3 generation → GPT-4o Vision quality check.

INPUTS REQUIRED:
1. Subject reference photograph (uploaded by user)
2. Brand logo file/s
3. BoardroomCXO logo file
4. LinkedIn post text (finalised)
5. Headline text and accent word (for overlay)
6. Supporting line (subject name and title)

STAGE 1 — REFERENCE PHOTO ANALYSIS (GPT-4o Vision):
Extract precise visual description of: face (shape, eyes, nose, lips, jaw, skin tone, marks), hair (colour, texture, style), expression, clothing (type, colour, fabric), glasses if present, build and posture. Output as SUBJECT DESCRIPTION — GROUND TRUTH block.

STAGE 2 — DALL-E 3 PROMPT:
Format: 4:5 portrait, high resolution, LinkedIn-optimised. Single subject, centre or slightly left. Three-quarter body. Clean negative space right mid-frame for logo. No props or background elements.
Subject: Reproduce from Stage 1 exactly. Natural imperfect skin — pores visible, no smoothing, no beautification, no idealisation. Real fabric texture. Natural asymmetry. Photorealistic.
Lighting: One dominant directional studio light. Realistic shadow. Shallow depth of field.
Background: Deep charcoal-to-warm-grey gradient. Darker at edges. Soft bokeh. No textures or patterns.
Text area: Bottom 20-22% — dark charcoal fade. Line 1 headline in white (accent word in gold #FF6B00). Line 2 subject name/title in white. Line 3 "Follow @boardroomcxo" in muted white 60% opacity.
Logo zones: Top-right placeholder for BoardroomCXO logo. Right mid-frame placeholder for brand logo. Both described as clean neutral zones for manual compositing.
Overall feel: Editorial photography. The Ken meets Bloomberg Businessweek. Real, human, credible, authoritative. Not AI-looking.

STAGE 3 — QUALITY CHECK (GPT-4o Vision):
Score 9 criteria: Face match (25pts), Skin realism (15pts), Shadow depth (10pts), Clothing accuracy (10pts), Background quality (10pts), Lighting quality (10pts), Text area (10pts), Logo placeholder zones (5pts), Overall editorial feel (5pts). Total /100.
85-100: Deliver. 70-84: Refine and regenerate (Attempt 2). Below 70: Reject and regenerate. Max 3 attempts. Deliver best result with full quality report.

LIMITATIONS TO DECLARE: DALL-E 3 generates from text descriptions. Face will be close but not pixel-perfect. Logo zones must be composited manually in Canva or Figma (5-10 minutes).`
  }
];

async function initPromptsPanel() {
  const body = document.getElementById('prompts-body');

  let settingsMap = {};
  if (isProd) {
    try {
      const res = await fetch('/api/settings', { headers: { 'x-access-passphrase': passphrase } });
      const data = await res.json();
      (data.settings || []).forEach(s => { settingsMap[s.key] = s; });
    } catch { /* render with empty values */ }
  }

  body.innerHTML = '';

  PROMPT_DEFS.forEach(def => {
    const currentValue = isProd
      ? (settingsMap[def.key]?.value || def.demo)  // fall back to bundled prompt if DB is empty
      : def.demo;

    const updatedAt = settingsMap[def.key]?.updated_at
      ? 'Last saved: ' + fmtDate(settingsMap[def.key].updated_at)
      : '';

    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `
      <div class="prompt-card-header">
        <div>
          <div class="prompt-card-label">${def.label}</div>
          <div style="font-size:11px;color:#aaa;margin-top:2px">${def.desc}</div>
        </div>
        <div class="prompt-card-key">${def.key}</div>
      </div>
      <textarea class="prompt-textarea" id="ta-${def.key}" spellcheck="false">${escHtml(currentValue)}</textarea>
      <div class="prompt-card-footer">
        <button class="save-btn" id="save-${def.key}">Save Prompt</button>
        <span class="prompt-saved-msg" id="msg-${def.key}">Saved.</span>
        <span class="prompt-updated" id="upd-${def.key}">${updatedAt}</span>
      </div>`;
    body.appendChild(card);

    document.getElementById(`save-${def.key}`).addEventListener('click', async () => {
      const btn = document.getElementById(`save-${def.key}`);
      const msgEl = document.getElementById(`msg-${def.key}`);
      const val = document.getElementById(`ta-${def.key}`).value.trim();
      if (!val) return;
      btn.disabled = true;
      btn.textContent = 'Saving...';
      if (isProd) {
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase },
            body: JSON.stringify({ key: def.key, value: val })
          });
        } catch { /* continue */ }
      }
      btn.disabled = false;
      btn.textContent = 'Save Prompt';
      msgEl.classList.add('show');
      document.getElementById(`upd-${def.key}`).textContent = 'Last saved: just now';
      setTimeout(() => msgEl.classList.remove('show'), 2500);
    });
  });
}

/* ── KEYWORDS PANEL ─────────────────────────────────────────── */

let keywordTerms = [];

const DEMO_KEYWORDS = [
  'executive search India', 'CXO hiring India', 'D2C leadership', 'jewellery brands India',
  'consumer brand talent', 'UAE executive roles', 'fashion leadership India', 'FMCG CXO',
  'luxury brand India', 'founder-led brands', 'senior leadership D2C', 'BoardroomCXO',
  'Indian consumer brands', 'D2C India', 'jewellery sector India', 'fashion retail India',
  'executive search UAE', 'consumer brand hiring', 'CHRO India', 'CMO hiring India',
  'brand transformation India', 'retail leadership', 'CEO hiring consumer brand'
];

async function initKeywordsPanel() {
  const body = document.getElementById('keywords-body');

  if (isProd) {
    try {
      const res = await fetch('/api/settings', { headers: { 'x-access-passphrase': passphrase } });
      const data = await res.json();
      keywordTerms = (data.settings || [])
        .filter(s => s.category === 'keyword')
        .map(s => s.value);
    } catch { keywordTerms = []; }
    // Fall back to defaults if DB is empty
    if (!keywordTerms.length) keywordTerms = [...DEMO_KEYWORDS];
  } else {
    keywordTerms = [...DEMO_KEYWORDS];
  }

  body.innerHTML = `
    <div class="settings-section-title">Research and SEO keywords</div>
    <div style="font-size:12px;color:#888;margin-bottom:16px;line-height:1.6">These keywords guide the research engine when finding leaders and articles. They also appear in generated posts and SEO metadata.</div>
    <div class="blacklist-add-row">
      <input type="text" id="kw-input" class="form-input" placeholder="Add keyword or phrase..." />
      <button class="save-btn" id="kw-add-btn">Add</button>
    </div>
    <div id="kw-msg" class="settings-msg" style="display:none"></div>
    <div style="margin-top:16px">
      <div id="kw-tags" class="kw-tags"></div>
    </div>`;

  renderKeywordTags();

  document.getElementById('kw-add-btn').addEventListener('click', addKeyword);
  document.getElementById('kw-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addKeyword();
  });
}

async function addKeyword() {
  const input = document.getElementById('kw-input');
  const msgEl = document.getElementById('kw-msg');
  const term = input.value.trim();
  if (!term) return;
  if (keywordTerms.includes(term)) {
    showMsg(msgEl, 'That keyword is already in the list.', 'error');
    return;
  }

  if (isProd) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase },
        body: JSON.stringify({ key: `kw_${Date.now()}`, value: term, category: 'keyword', label: term })
      });
    } catch { /* continue */ }
  }

  keywordTerms.unshift(term);
  input.value = '';
  renderKeywordTags();
  showMsg(msgEl, `"${term}" added.`, 'success');
}

async function deleteKeyword(term) {
  if (isProd) {
    try {
      await fetch('/api/settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase },
        body: JSON.stringify({ value: term, category: 'keyword' })
      });
    } catch { /* continue */ }
  }
  keywordTerms = keywordTerms.filter(t => t !== term);
  renderKeywordTags();
}

function renderKeywordTags() {
  const container = document.getElementById('kw-tags');
  if (!keywordTerms.length) {
    container.innerHTML = '<div class="blacklist-empty">No keywords yet. Add phrases used in your niche.</div>';
    return;
  }
  container.innerHTML = keywordTerms.map(term => `
    <span class="kw-tag">
      ${escHtml(term)}
      <button class="kw-tag-del" title="Remove" onclick="deleteKeyword(${JSON.stringify(term)})">&times;</button>
    </span>`).join('');
}

/* ── CALENDAR PANEL ─────────────────────────────────────────── */

const CALENDAR_STORE_KEY = 'bcxo_calendar_entries';

function loadCalendarEntries() {
  try { return JSON.parse(localStorage.getItem(CALENDAR_STORE_KEY) || '[]'); } catch { return []; }
}

function saveCalendarScheduledDate(id, date) {
  const entries = loadCalendarEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx !== -1) {
    entries[idx].scheduled_date = date;
    localStorage.setItem(CALENDAR_STORE_KEY, JSON.stringify(entries));
  }
  // Also persist to DB in prod
  if (isProd && id && !id.startsWith('local_')) {
    fetch('/api/posts', {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ id, scheduled_date: date }),
    }).catch(() => {});
  }
}

function checkCalendarReminders() {
  const entries = loadCalendarEntries();
  const now = new Date();
  const reminders = entries.filter(e => {
    if (!e.scheduled_date) return false;
    const sched = new Date(e.scheduled_date);
    const daysUntil = (sched - now) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 2;
  });

  if (!reminders.length) return;

  const banner = document.getElementById('reminder-banner');
  if (!banner) return;
  const list = reminders.map(e => {
    const d = new Date(e.scheduled_date);
    const daysUntil = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'in 2 days';
    return `<strong>${escHtml(e.subject)}</strong> (${escHtml({ boardroomcxo: 'BoardroomCXO', ketul: 'CA Ketul Patel' }[e.profile] || e.profile)}) is scheduled to post <strong>${when}</strong>. Upload the image now.`;
  }).join('<br>');

  banner.innerHTML = `<i class="ti ti-bell" style="font-size:15px"></i> <span>${list}</span><button class="reminder-close" onclick="document.getElementById('reminder-banner').style.display='none'">&times;</button>`;
  banner.style.display = 'flex';
}

async function initCalendarPanel() {
  const body = document.getElementById('calendar-body');

  document.getElementById('cal-refresh-btn').addEventListener('click', () => {
    panelInited['calendar'] = false;
    body.innerHTML = '<div class="settings-loading"><i class="ti ti-loader-2 spin"></i> Loading posts...</div>';
    panelInited['calendar'] = true;
    loadCalendar();
  });
  document.getElementById('cal-profile-filter').addEventListener('change', loadCalendar);
  document.getElementById('cal-status-filter').addEventListener('change', loadCalendar);

  await loadCalendar();
}

async function loadCalendar() {
  const body = document.getElementById('calendar-body');
  const profileF = document.getElementById('cal-profile-filter').value;

  // Load from localStorage (entries added only after image generation)
  let entries = loadCalendarEntries();
  if (profileF) entries = entries.filter(e => e.profile === profileF);

  const profileLabel = { boardroomcxo: 'BoardroomCXO', ketul: 'CA Ketul Patel' };

  if (!entries.length) {
    body.innerHTML = `
      <div class="cal-empty">
        <i class="ti ti-calendar-off" style="font-size:28px;color:#ddd;display:block;margin-bottom:10px"></i>
        No posts in the calendar yet.<br>
        <span style="font-size:11px;color:#aaa">Posts appear here after you generate an image in Chat. Complete the full flow: Brew post → Approve → Generate image.</span>
      </div>`;
    return;
  }

  // Check for upcoming reminders
  checkCalendarReminders();

  body.innerHTML = `
    <div class="cal-info-note">Posts below have completed image generation and are ready to publish. Set a scheduled date and the tool will remind you 2 days before.</div>
    <table class="cal-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Profile</th>
          <th>Virality</th>
          <th>Scheduled Date</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(p => {
          const scheduledVal = p.scheduled_date ? p.scheduled_date.substring(0, 10) : '';
          const daysUntil = p.scheduled_date ? Math.ceil((new Date(p.scheduled_date) - new Date()) / (1000*60*60*24)) : null;
          const reminderBadge = (daysUntil !== null && daysUntil >= 0 && daysUntil <= 2)
            ? `<span class="cal-reminder-badge"><i class="ti ti-bell"></i> ${daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : 'In 2 days'}</span>`
            : '';
          return `
          <tr>
            <td>${escHtml(p.subject || 'Untitled')}</td>
            <td><span class="cal-profile-badge ${p.profile}">${escHtml(profileLabel[p.profile] || p.profile)}</span></td>
            <td class="cal-score">${p.virality_score != null ? p.virality_score + '/100' : '--'}</td>
            <td class="cal-date-cell">
              <input type="date" class="cal-date-input" value="${scheduledVal}" data-entry-id="${escHtml(p.id)}" />
              ${reminderBadge}
            </td>
            <td><span class="cal-status ${p.status || 'approved'}">${capFirst(p.status || 'approved')}</span></td>
            <td class="cal-date">${fmtDate(p.created_at)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  // Wire up date inputs
  body.querySelectorAll('.cal-date-input').forEach(input => {
    input.addEventListener('change', () => {
      saveCalendarScheduledDate(input.dataset.entryId, input.value || null);
      loadCalendar(); // re-render to show/hide reminder badges
    });
  });
}

/* ── PERFORMANCE PANEL ──────────────────────────────────────── */

const DEMO_LOGS = [
  { id: 'l001', post_id: 'p001', subject: 'Nita Ambani — Reliance Retail pivot', platform: 'linkedin',  likes: 312, comments: 47, reposts: 38, impressions: 8400, logged_at: '2026-06-21T10:00:00' },
  { id: 'l002', post_id: 'p002', subject: 'Titan Q4 results',                    platform: 'linkedin',  likes: 198, comments: 29, reposts: 22, impressions: 5100, logged_at: '2026-06-19T11:30:00' },
  { id: 'l003', post_id: 'p001', subject: 'Nita Ambani — Reliance Retail pivot', platform: 'instagram', likes: 541, comments: 63, reposts: 0,  impressions: 14200, logged_at: '2026-06-22T09:00:00' }
];

let perfAvailablePosts = [];
let perfSelectedPostId = null;
let perfSelectedSubject = null;

async function initPerformancePanel() {
  // Show info note
  const infoEl = document.getElementById('perf-post-picker-wrap');
  if (infoEl) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;color:#888;margin-bottom:12px;line-height:1.6;padding:8px 10px;background:#f5f5f5;border-radius:6px;border-left:3px solid #C9A84C;';
    note.innerHTML = 'Posts appear here after you <strong>Approve</strong> them in the Chat. Generate a post, click Approve Post, then come back here to log its metrics.';
    infoEl.parentNode.insertBefore(note, infoEl);
  }

  // Load available posts for picker
  if (isProd) {
    try {
      const res = await fetch('/api/posts?status=approved', { headers: { 'x-access-passphrase': passphrase } });
      const data = await res.json();
      perfAvailablePosts = (data.posts || []).slice(0, 30);
    } catch { perfAvailablePosts = []; }
  } else {
    perfAvailablePosts = loadCalendarEntries();
  }

  renderPerfPostPicker();

  if (isProd) {
    try {
      const res = await fetch('/api/performance', { headers: { 'x-access-passphrase': passphrase } });
      const data = await res.json();
      renderPerfLogs(data.logs || []);
    } catch { renderPerfLogs([]); }
  } else {
    renderPerfLogs(DEMO_LOGS);
  }

  document.getElementById('perf-log-btn').addEventListener('click', async () => {
    const btn     = document.getElementById('perf-log-btn');
    const msgEl   = document.getElementById('perf-msg');

    if (!perfSelectedPostId) {
      showMsg(msgEl, 'Please select a post first.', 'error');
      return;
    }

    const platform    = document.getElementById('perf-platform').value;
    const likes       = parseInt(document.getElementById('perf-likes').value) || 0;
    const comments    = parseInt(document.getElementById('perf-comments').value) || 0;
    const reposts     = parseInt(document.getElementById('perf-reposts').value) || 0;
    const impressions = parseInt(document.getElementById('perf-impressions').value) || 0;
    const notes       = document.getElementById('perf-notes').value.trim();

    btn.disabled = true;
    btn.textContent = 'Logging...';

    if (isProd) {
      try {
        await fetch('/api/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase },
          body: JSON.stringify({ post_id: perfSelectedPostId, platform, likes, comments, reposts, impressions, notes })
        });
      } catch { /* continue */ }
    }

    btn.disabled = false;
    btn.textContent = 'Log Metrics';
    showMsg(msgEl, 'Metrics logged successfully.', 'success');

    document.getElementById('perf-likes').value = '0';
    document.getElementById('perf-comments').value = '0';
    document.getElementById('perf-reposts').value = '0';
    document.getElementById('perf-impressions').value = '0';
    document.getElementById('perf-notes').value = '';
  });
}

function renderPerfPostPicker() {
  const pickerWrap = document.getElementById('perf-post-picker-wrap');
  if (!pickerWrap) return;

  const searchInput = document.getElementById('perf-post-search');
  const dropdown = document.getElementById('perf-post-dropdown');
  const selectedDisplay = document.getElementById('perf-selected-display');

  let filteredPosts = [...perfAvailablePosts];

  function renderDropdown(posts) {
    if (!posts.length) {
      dropdown.innerHTML = '<div class="post-picker-empty">No posts found.</div>';
    } else {
      dropdown.innerHTML = posts.slice(0, 7).map(p => `
        <div class="post-picker-item" data-id="${escHtml(p.id)}" data-subject="${escHtml(p.subject || 'Untitled')}">
          <div class="post-picker-item-subject">${escHtml(p.subject || 'Untitled')}</div>
          <div class="post-picker-item-meta">
            <span class="cal-profile-badge ${p.profile}" style="font-size:9px">${p.profile}</span>
            <span class="cal-date">${fmtDate(p.created_at)}</span>
          </div>
        </div>`).join('');

      dropdown.querySelectorAll('.post-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          perfSelectedPostId = item.dataset.id;
          perfSelectedSubject = item.dataset.subject;
          searchInput.value = perfSelectedSubject;
          dropdown.style.display = 'none';
          selectedDisplay.textContent = `Selected: ${perfSelectedSubject}`;
          selectedDisplay.style.display = 'block';
        });
      });
    }
    dropdown.style.display = 'block';
  }

  searchInput.addEventListener('focus', () => {
    filteredPosts = [...perfAvailablePosts];
    renderDropdown(filteredPosts);
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    filteredPosts = perfAvailablePosts.filter(p => (p.subject || '').toLowerCase().includes(q));
    renderDropdown(filteredPosts);
    perfSelectedPostId = null;
    selectedDisplay.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!pickerWrap.contains(e.target)) dropdown.style.display = 'none';
  }, true);

  // Show recent posts immediately
  renderDropdown(perfAvailablePosts.slice(0, 7));
  dropdown.style.display = 'none';
}

function renderPerfLogs(logs) {
  const body = document.getElementById('perf-logs-body');
  if (!logs.length) {
    body.innerHTML = '<div class="cal-empty">No logs yet. Log metrics above after each post goes live.</div>';
    return;
  }
  body.innerHTML = `
    <table class="perf-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Platform</th>
          <th>Likes</th>
          <th>Comments</th>
          <th>Reposts</th>
          <th>Impressions</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td>${escHtml(l.subject || l.post_id || '--')}</td>
            <td><span class="cal-status ${l.platform === 'linkedin' ? 'approved' : l.platform === 'instagram' ? 'review' : 'draft'}">${capFirst(l.platform)}</span></td>
            <td class="perf-metric">${l.likes}</td>
            <td class="perf-metric">${l.comments}</td>
            <td class="perf-metric">${l.reposts}</td>
            <td class="perf-metric">${l.impressions?.toLocaleString() || '0'}</td>
            <td class="cal-date">${fmtDate(l.logged_at)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── BLACKLIST PANEL ────────────────────────────────────────── */

const DEMO_BLACKLIST = [
  { id: 'b001', term: 'cryptocurrency' },
  { id: 'b002', term: 'metaverse' },
  { id: 'b003', term: 'NFT' },
  { id: 'b004', term: 'Web3' },
  { id: 'b005', term: 'political commentary' },
  { id: 'b006', term: 'Vijayakumar C' },
  { id: 'b007', term: 'Suresh Narayanan' },
  { id: 'b008', term: 'Mithun Sacheti' },
  { id: 'b009', term: 'controversial leaders' },
  { id: 'b010', term: 'sports leadership' }
];

let blacklistTerms = [];

async function initBlacklistPanel() {
  if (isProd) {
    try {
      const res = await fetch('/api/blacklist', { headers: { 'x-access-passphrase': passphrase } });
      const data = await res.json();
      blacklistTerms = (data.terms || []).map(t => t.term);
    } catch { blacklistTerms = []; }
    if (!blacklistTerms.length) blacklistTerms = DEMO_BLACKLIST.map(t => t.term);
  } else {
    blacklistTerms = DEMO_BLACKLIST.map(t => t.term);
  }

  renderBlacklistTags();

  document.getElementById('blacklist-add-btn').addEventListener('click', addBlacklistTerm);
  document.getElementById('blacklist-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addBlacklistTerm();
  });
}

async function addBlacklistTerm() {
  const input = document.getElementById('blacklist-input');
  const msgEl = document.getElementById('blacklist-msg');
  const term = input.value.trim();
  if (!term) return;
  if (blacklistTerms.includes(term)) {
    showMsg(msgEl, 'That term is already in the list.', 'error');
    return;
  }

  if (isProd) {
    try {
      await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase },
        body: JSON.stringify({ term })
      });
    } catch { /* continue */ }
  }

  blacklistTerms.unshift(term);
  input.value = '';
  renderBlacklistTags();
  showMsg(msgEl, `"${term}" added to blacklist.`, 'success');
}

async function deleteBlacklistTerm(term) {
  if (isProd) {
    try {
      await fetch('/api/blacklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-access-passphrase': passphrase },
        body: JSON.stringify({ term })
      });
    } catch { /* continue */ }
  }
  blacklistTerms = blacklistTerms.filter(t => t !== term);
  renderBlacklistTags();
}

function renderBlacklistTags() {
  const container = document.getElementById('blacklist-tags');
  if (!blacklistTerms.length) {
    container.innerHTML = '<div class="blacklist-empty">No blocked terms yet. Add topics you never want suggested.</div>';
    return;
  }
  container.innerHTML = blacklistTerms.map(term => `
    <span class="blacklist-tag">
      ${escHtml(term)}
      <button class="blacklist-tag-del" title="Remove" onclick="deleteBlacklistTerm(${JSON.stringify(term)})">&times;</button>
    </span>`).join('');
}

/* ── PREFERENCES PANEL ──────────────────────────────────────── */

const PREFS_LOCAL_KEY = 'bcxo_preferences';

function loadLocalPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_LOCAL_KEY) || '{}'); } catch { return {}; }
}

function saveLocalPrefs(prefs) {
  localStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(prefs));
}

async function initPreferencesPanel() {
  const body = document.getElementById('preferences-body');
  const prefs = loadLocalPrefs();
  const storedLogos = loadStoredLogos();

  function logoSlotHtml(key, label) {
    const stored = storedLogos[key];
    return `
      <div class="pref-logo-slot" id="pref-slot-wrap-${key}">
        <div class="pref-logo-label">${label}</div>
        ${stored
          ? `<img class="pref-logo-preview" id="pref-logo-img-${key}" src="${stored}" />
             <div class="pref-logo-slot-actions">
               <label class="pref-upload-replace-btn">
                 Change
                 <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none" data-logo-key="${key}" class="pref-logo-file-input" />
               </label>
               <button class="slot-clear-btn" onclick="clearStoredLogoAndRefreshPrefs('${key}')">Remove</button>
             </div>`
          : `<label class="pref-logo-upload-zone">
               <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none" data-logo-key="${key}" class="pref-logo-file-input" />
               <i class="ti ti-upload" style="font-size:18px;color:#bbb"></i>
               <div style="font-size:11px;color:#aaa;margin-top:4px">Click to upload</div>
             </label>`}
      </div>`;
  }

  body.innerHTML = `
    <div class="settings-section-title">Content defaults</div>
    <div class="pref-card">
      <div class="pref-row">
        <label class="pref-label">Default profile on login</label>
        <select id="pref-default-profile" class="form-input pref-select">
          <option value="boardroomcxo" ${(prefs.defaultProfile || 'boardroomcxo') === 'boardroomcxo' ? 'selected' : ''}>BoardroomCXO</option>
          <option value="ketul" ${prefs.defaultProfile === 'ketul' ? 'selected' : ''}>CA Ketul Patel</option>
        </select>
      </div>
      <div class="pref-row">
        <label class="pref-label">Article freshness (industry news)</label>
        <select id="pref-article-freshness" class="form-input pref-select">
          <option value="7" ${prefs.articleFreshness === 7 ? 'selected' : ''}>Last 7 days</option>
          <option value="15" ${(!prefs.articleFreshness || prefs.articleFreshness === 15) ? 'selected' : ''}>Last 15 days</option>
          <option value="25" ${prefs.articleFreshness === 25 ? 'selected' : ''}>Last 20-25 days (recommended)</option>
        </select>
      </div>
      <div class="pref-row">
        <label class="pref-label">Minimum virality score to show</label>
        <input type="number" id="pref-min-virality" class="form-input pref-select" value="${prefs.minVirality || 70}" min="0" max="100" />
      </div>
    </div>

    <div class="settings-section-title" style="margin-top:24px">Saved brand logos</div>
    <div style="font-size:12px;color:#888;margin-bottom:14px;line-height:1.5">Logos saved here are reused automatically in the image generation flow. Remove and re-upload anytime.</div>
    <div class="pref-logos-grid" id="pref-logos-grid">
      ${logoSlotHtml('bcxo_logo', 'BoardroomCXO Logo')}
      ${logoSlotHtml('logo1', 'Logo Slot 1')}
      ${logoSlotHtml('logo2', 'Logo Slot 2')}
      ${logoSlotHtml('logo3', 'Logo Slot 3')}
      ${logoSlotHtml('logo4', 'Logo Slot 4')}
    </div>

    <div style="margin-top:24px;display:flex;align-items:center;gap:12px">
      <button class="save-btn" id="pref-save-btn">Save Preferences</button>
      <div id="pref-msg" class="settings-msg" style="display:none"></div>
    </div>`;

  document.getElementById('pref-save-btn').addEventListener('click', () => {
    const updated = {
      ...prefs,
      defaultProfile: document.getElementById('pref-default-profile').value,
      articleFreshness: parseInt(document.getElementById('pref-article-freshness').value),
      minVirality: parseInt(document.getElementById('pref-min-virality').value) || 70,
    };
    saveLocalPrefs(updated);
    showMsg(document.getElementById('pref-msg'), 'Preferences saved.', 'success');
  });

  // Wire up logo file inputs
  document.querySelectorAll('.pref-logo-file-input').forEach(input => {
    input.addEventListener('change', () => {
      const file = input.files[0];
      const key = input.dataset.logoKey;
      if (!file || !key) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        saveStoredLogo(key, e.target.result);
        panelInited['preferences'] = false;
        initPreferencesPanel();
      };
      reader.readAsDataURL(file);
    });
  });
}

function clearStoredLogoAndRefreshPrefs(key) {
  clearStoredLogo(key);
  panelInited['preferences'] = false;
  initPreferencesPanel();
}

/* ── SHARED HELPERS ─────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function capFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'settings-msg ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
