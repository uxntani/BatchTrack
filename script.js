/* ═══════════════════════════════════════════════
   EduTrack — script.js
   Handles: Auth, Navigation, Batches, Students,
            Notes, Tests (MCQ), Leaderboard, Badges
   Storage: localStorage
═══════════════════════════════════════════════ */

/* ── COLOUR PALETTE for batch avatars ─────────── */
const BATCH_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#14b8a6',
  '#f59e0b','#ef4444','#10b981','#3b82f6'
];

/* ══════════════════════════════════════════
   1. STORAGE HELPERS
══════════════════════════════════════════ */
const db = {
  get: (key, def = []) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
  },
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),

  // Namespaced helpers
  users:    () => db.get('et_users', []),
  batches:  () => db.get('et_batches', []),
  students: () => db.get('et_students', []),
  notes:    () => db.get('et_notes', []),
  tests:    () => db.get('et_tests', []),
  scores:   () => db.get('et_scores', []),       // { studentId, testId, score, total, pct }

  saveUsers:    (d) => db.set('et_users', d),
  saveBatches:  (d) => db.set('et_batches', d),
  saveStudents: (d) => db.set('et_students', d),
  saveNotes:    (d) => db.set('et_notes', d),
  saveTests:    (d) => db.set('et_tests', d),
  saveScores:   (d) => db.set('et_scores', d),

  currentUser: () => db.get('et_current', null),
  setCurrentUser: (u) => db.set('et_current', u),
  clearCurrentUser: () => localStorage.removeItem('et_current'),
};

/* Generate simple unique IDs */
const uid = () => Math.random().toString(36).slice(2, 10);

/* ══════════════════════════════════════════
   2. AUTH
══════════════════════════════════════════ */

/** Switch between login and register forms */
function switchAuth(mode) {
  document.getElementById('login-form').classList.toggle('active', mode === 'login');
  document.getElementById('register-form').classList.toggle('active', mode === 'register');
  clearAuthErrors();
}

function clearAuthErrors() {
  ['login-error','reg-error'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.add('hidden');
  });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

/** Register a new teacher account */
function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;

  if (!name)             return showAuthError('reg-error', 'Please enter your name.');
  if (!email.includes('@')) return showAuthError('reg-error', 'Please enter a valid email.');
  if (password.length < 6) return showAuthError('reg-error', 'Password must be at least 6 characters.');

  const users = db.users();
  if (users.find(u => u.email === email))
    return showAuthError('reg-error', 'An account with this email already exists.');

  const user = { id: uid(), name, email, password, createdAt: Date.now() };
  users.push(user);
  db.saveUsers(users);
  db.setCurrentUser({ id: user.id, name: user.name, email: user.email });

  launchApp();
}

/** Log in an existing teacher */
function handleLogin() {
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return showAuthError('login-error', 'Please fill in all fields.');

  const users = db.users();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return showAuthError('login-error', 'Invalid email or password.');

  db.setCurrentUser({ id: user.id, name: user.name, email: user.email });
  launchApp();
}

/** Log out and return to auth screen */
function handleLogout() {
  db.clearCurrentUser();
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  // Reset login form
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  switchAuth('login');
}

/* ══════════════════════════════════════════
   3. APP LAUNCH / BOOT
══════════════════════════════════════════ */

/** Transition from auth to app */
function launchApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  bootApp();
}

/** Bootstrap the app after login */
function bootApp() {
  const user = db.currentUser();
  if (!user) return;

  // Set greeting & avatars
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sidebar-avatar').textContent  = initials;
  document.getElementById('mobile-avatar').textContent   = initials;
  document.getElementById('sidebar-name').textContent    = user.name;

  // Greeting based on hour
  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greeting}, ${user.name.split(' ')[0]}! 👋`;

  navigate('dashboard');
}

/* ══════════════════════════════════════════
   4. NAVIGATION
══════════════════════════════════════════ */

let currentSection = 'dashboard';

function navigate(section) {
  // Close sidebar on mobile
  if (window.innerWidth < 769) toggleSidebar(false);

  // Deactivate all sections + nav items
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate target
  document.getElementById(`section-${section}`).classList.add('active');
  document.querySelector(`[data-section="${section}"]`).classList.add('active');
  currentSection = section;

  // Render relevant section
  const renders = {
    dashboard:   renderDashboard,
    batches:     renderBatches,
    students:    renderStudents,
    notes:       renderNotes,
    tests:       renderTests,
    leaderboard: renderLeaderboard,
    badges:      renderBadges,
  };
  if (renders[section]) renders[section]();
}

/* ══════════════════════════════════════════
   5. SIDEBAR TOGGLE (mobile)
══════════════════════════════════════════ */

function toggleSidebar(force) {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', isOpen);
  overlay.classList.toggle('open', isOpen);
}

/* ══════════════════════════════════════════
   6. MODAL HELPERS
══════════════════════════════════════════ */

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
/** Close modal when clicking the dark overlay (not the inner card) */
function overlayClose(event, id) {
  if (event.target === document.getElementById(id)) closeModal(id);
}

/* ══════════════════════════════════════════
   7. TOAST
══════════════════════════════════════════ */

let toastTimer;
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
}

/* ══════════════════════════════════════════
   8. DASHBOARD
══════════════════════════════════════════ */

function renderDashboard() {
  const batches  = db.batches();
  const students = db.students();
  const tests    = db.tests();
  const notes    = db.notes();
  const scores   = db.scores();

  // Stats counters
  document.getElementById('stat-batches').textContent  = batches.length;
  document.getElementById('stat-students').textContent = students.length;
  document.getElementById('stat-tests').textContent    = tests.length;
  document.getElementById('stat-notes').textContent    = notes.length;

  // Recent students (last 5)
  const recentStudents = [...students].reverse().slice(0, 5);
  const dashStudents   = document.getElementById('dash-students');
  if (!recentStudents.length) {
    dashStudents.innerHTML = `<p class="dash-empty">No students yet.</p>`;
  } else {
    dashStudents.innerHTML = recentStudents.map(s => `
      <div class="dash-list-item">
        <div class="avatar" style="background:${avatarBg(s.name)}">${initials(s.name)}</div>
        <div>
          <div style="font-weight:600;font-size:.88rem">${s.name}</div>
          <div style="font-size:.76rem;color:var(--text-muted)">${batchName(s.batchId, batches)}</div>
        </div>
      </div>
    `).join('');
  }

  // Top performers (top 5 by totalScore)
  const ranked = buildLeaderboard(students, scores).slice(0, 5);
  const dashLb = document.getElementById('dash-leaderboard');
  if (!ranked.length) {
    dashLb.innerHTML = `<p class="dash-empty">No scores yet.</p>`;
  } else {
    dashLb.innerHTML = ranked.map((r, i) => {
      const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      return `
        <div class="dash-list-item">
          <div class="rank-badge ${cls}">${i + 1}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:.88rem">${r.name}</div>
          </div>
          <div style="font-weight:700;font-size:.88rem;color:var(--indigo-600)">${r.totalScore} pts</div>
        </div>`;
    }).join('');
  }
}

/* ══════════════════════════════════════════
   9. BATCHES
══════════════════════════════════════════ */

function addBatch() {
  const name    = document.getElementById('batch-name').value.trim();
  const subject = document.getElementById('batch-subject').value.trim();
  if (!name) return showToast('⚠️ Please enter a batch name.');

  const batches = db.batches();
  const color   = BATCH_COLORS[batches.length % BATCH_COLORS.length];
  batches.push({ id: uid(), name, subject, color, createdAt: Date.now() });
  db.saveBatches(batches);

  document.getElementById('batch-name').value    = '';
  document.getElementById('batch-subject').value = '';
  closeModal('batch-modal');
  showToast('✅ Batch created!');
  renderBatches();
  refreshBatchDropdowns();
}

function deleteBatch(id) {
  if (!confirm('Delete this batch? Students in it will become unassigned.')) return;
  db.saveBatches(db.batches().filter(b => b.id !== id));
  // Unassign students
  const students = db.students().map(s => s.batchId === id ? { ...s, batchId: '' } : s);
  db.saveStudents(students);
  showToast('🗑️ Batch deleted.');
  renderBatches();
  refreshBatchDropdowns();
}

function renderBatches() {
  const batches  = db.batches();
  const students = db.students();
  const grid     = document.getElementById('batches-grid');

  if (!batches.length) {
    grid.innerHTML = emptyState('ph-books', 'No batches yet. Create one!');
    return;
  }

  grid.innerHTML = batches.map(b => {
    const count = students.filter(s => s.batchId === b.id).length;
    return `
      <div class="item-card batch-card" style="border-top-color:${b.color}">
        <div class="item-card-header">
          <div class="avatar" style="background:${b.color}">${initials(b.name)}</div>
          <div>
            <h4>${escHtml(b.name)}</h4>
            <div class="meta">${escHtml(b.subject || 'General')}</div>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="tag"><i class="ph ph-student"></i> ${count} student${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="actions">
          <button class="btn-ghost" onclick="navigate('students')">View Students</button>
          <button class="btn-danger" onclick="deleteBatch('${b.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   10. STUDENTS
══════════════════════════════════════════ */

function addStudent() {
  const name    = document.getElementById('student-name').value.trim();
  const email   = document.getElementById('student-email').value.trim().toLowerCase();
  const batchId = document.getElementById('student-batch').value;

  if (!name)  return showToast('⚠️ Please enter a student name.');
  if (!email || !email.includes('@')) return showToast('⚠️ Enter a valid email.');

  const students = db.students();
  if (students.find(s => s.email === email))
    return showToast('⚠️ A student with this email already exists.');

  students.push({ id: uid(), name, email, batchId, createdAt: Date.now() });
  db.saveStudents(students);

  document.getElementById('student-name').value  = '';
  document.getElementById('student-email').value = '';
  document.getElementById('student-batch').value = '';
  closeModal('student-modal');
  showToast('✅ Student added!');
  renderStudents();
  renderDashboard();
}

function deleteStudent(id) {
  if (!confirm('Remove this student?')) return;
  db.saveStudents(db.students().filter(s => s.id !== id));
  db.saveScores(db.scores().filter(s => s.studentId !== id));
  showToast('🗑️ Student removed.');
  renderStudents();
}

function renderStudents() {
  const batches = db.batches();
  const filter  = document.getElementById('student-batch-filter')?.value || '';
  const search  = (document.getElementById('student-search')?.value || '').toLowerCase();

  // Refresh batch filter dropdown
  const filterSel = document.getElementById('student-batch-filter');
  if (filterSel) {
    const curFilter = filterSel.value;
    filterSel.innerHTML = '<option value="">All Batches</option>' +
      batches.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');
    filterSel.value = curFilter;
  }

  let students = db.students();
  if (filter) students = students.filter(s => s.batchId === filter);
  if (search) students = students.filter(s =>
    s.name.toLowerCase().includes(search) || s.email.toLowerCase().includes(search));

  const grid   = document.getElementById('students-grid');
  const scores = db.scores();

  if (!students.length) {
    grid.innerHTML = emptyState('ph-student', 'No students match your filter.');
    return;
  }

  grid.innerHTML = students.map(s => {
    const bn   = batchName(s.batchId, batches);
    const bColor = batches.find(b => b.id === s.batchId)?.color || '#6366f1';
    const studentScores = scores.filter(sc => sc.studentId === s.id);
    const total = studentScores.reduce((acc, sc) => acc + sc.score, 0);
    return `
      <div class="item-card">
        <div class="item-card-header">
          <div class="avatar" style="background:${avatarBg(s.name)}">${initials(s.name)}</div>
          <div style="flex:1;min-width:0">
            <h4>${escHtml(s.name)}</h4>
            <div class="meta">${escHtml(s.email)}</div>
          </div>
        </div>
        ${bn ? `<span class="tag" style="background:${bColor}22;color:${bColor}"><i class="ph ph-books"></i> ${escHtml(bn)}</span>` : ''}
        <div style="font-size:.8rem;color:var(--text-muted)">
          Tests: <strong>${studentScores.length}</strong> &nbsp;|&nbsp; Total Score: <strong style="color:var(--indigo-600)">${total}</strong>
        </div>
        <div class="actions">
          <button class="btn-danger" onclick="deleteStudent('${s.id}')">Remove</button>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   11. NOTES
══════════════════════════════════════════ */

function addNote() {
  const title   = document.getElementById('note-title').value.trim();
  const batchId = document.getElementById('note-batch').value;
  const link    = document.getElementById('note-link').value.trim();
  const desc    = document.getElementById('note-desc').value.trim();

  if (!title) return showToast('⚠️ Please enter a title.');

  const notes = db.notes();
  notes.push({ id: uid(), title, batchId, link, desc, createdAt: Date.now() });
  db.saveNotes(notes);

  ['note-title','note-link','note-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('note-batch').value = '';
  closeModal('note-modal');
  showToast('✅ Note added!');
  renderNotes();
}

function deleteNote(id) {
  db.saveNotes(db.notes().filter(n => n.id !== id));
  showToast('🗑️ Note deleted.');
  renderNotes();
}

function renderNotes() {
  const notes   = db.notes();
  const batches = db.batches();
  const grid    = document.getElementById('notes-grid');

  if (!notes.length) {
    grid.innerHTML = emptyState('ph-note-pencil', 'No notes yet. Add study material!');
    return;
  }

  grid.innerHTML = [...notes].reverse().map(n => {
    const bn    = batchName(n.batchId, batches);
    const bColor = batches.find(b => b.id === n.batchId)?.color || '#14b8a6';
    return `
      <div class="item-card note-card">
        <div class="item-card-header">
          <div class="avatar" style="background:#14b8a6"><i class="ph ph-note-pencil" style="font-size:1rem"></i></div>
          <div style="flex:1;min-width:0">
            <h4>${escHtml(n.title)}</h4>
            <div class="meta">${new Date(n.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
        </div>
        ${bn ? `<span class="tag" style="background:${bColor}22;color:${bColor}"><i class="ph ph-books"></i> ${escHtml(bn)}</span>` : ''}
        ${n.desc ? `<div style="font-size:.85rem;color:var(--text-muted)">${escHtml(n.desc)}</div>` : ''}
        ${n.link ? `<a href="${escHtml(n.link)}" target="_blank" class="note-link"><i class="ph ph-link"></i> Open Resource</a>` : ''}
        <div class="actions">
          <button class="btn-danger" onclick="deleteNote('${n.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   12. TESTS (MCQ)
══════════════════════════════════════════ */

let questionCount = 0;

/** Open test-creation modal and reset builder */
function openModal_test() {
  questionCount = 0;
  document.getElementById('questions-builder').innerHTML = '';
  document.getElementById('test-title').value = '';
  openModal('test-modal');
  addQuestionField(); // Start with one question
}

/** Add a question row to the builder */
function addQuestionField() {
  questionCount++;
  const qn  = questionCount;
  const div = document.createElement('div');
  div.className = 'question-block';
  div.id = `q-block-${qn}`;
  div.innerHTML = `
    <div class="q-header">
      <span class="q-label">Question ${qn}</span>
      <button class="btn-danger" onclick="removeQuestion(${qn})" style="padding:.3rem .6rem;font-size:.75rem">Remove</button>
    </div>
    <input type="text" id="q-text-${qn}" placeholder="Enter your question…"/>
    <div class="options-grid">
      <input type="text" id="q-opt-${qn}-A" placeholder="Option A"/>
      <input type="text" id="q-opt-${qn}-B" placeholder="Option B"/>
      <input type="text" id="q-opt-${qn}-C" placeholder="Option C"/>
      <input type="text" id="q-opt-${qn}-D" placeholder="Option D"/>
    </div>
    <select id="q-ans-${qn}">
      <option value="">— Select correct answer —</option>
      <option value="A">A</option>
      <option value="B">B</option>
      <option value="C">C</option>
      <option value="D">D</option>
    </select>`;
  document.getElementById('questions-builder').appendChild(div);
}

function removeQuestion(qn) {
  const el = document.getElementById(`q-block-${qn}`);
  if (el) el.remove();
}

/** Collect & save a test from the builder */
function saveTest() {
  const title   = document.getElementById('test-title').value.trim();
  const batchId = document.getElementById('test-batch').value;
  if (!title) return showToast('⚠️ Please enter a test title.');

  const blocks = document.querySelectorAll('.question-block');
  if (!blocks.length) return showToast('⚠️ Add at least one question.');

  const questions = [];
  for (const block of blocks) {
    const qn  = block.id.replace('q-block-', '');
    const text = document.getElementById(`q-text-${qn}`)?.value.trim();
    const optA = document.getElementById(`q-opt-${qn}-A`)?.value.trim();
    const optB = document.getElementById(`q-opt-${qn}-B`)?.value.trim();
    const optC = document.getElementById(`q-opt-${qn}-C`)?.value.trim();
    const optD = document.getElementById(`q-opt-${qn}-D`)?.value.trim();
    const ans  = document.getElementById(`q-ans-${qn}`)?.value;

    if (!text || !optA || !optB || !optC || !optD || !ans)
      return showToast(`⚠️ Please fill all fields for Question ${qn}.`);
    questions.push({ text, options: { A:optA, B:optB, C:optC, D:optD }, answer: ans });
  }

  const tests = db.tests();
  tests.push({ id: uid(), title, batchId, questions, createdAt: Date.now() });
  db.saveTests(tests);

  closeModal('test-modal');
  showToast('✅ Test saved!');
  renderTests();
}

function deleteTest(id) {
  if (!confirm('Delete this test and all its scores?')) return;
  db.saveTests(db.tests().filter(t => t.id !== id));
  db.saveScores(db.scores().filter(s => s.testId !== id));
  showToast('🗑️ Test deleted.');
  renderTests();
}

function renderTests() {
  const tests   = db.tests();
  const batches = db.batches();
  const grid    = document.getElementById('tests-grid');

  if (!tests.length) {
    grid.innerHTML = emptyState('ph-exam', 'No tests yet. Create your first MCQ test!');
    return;
  }

  grid.innerHTML = [...tests].reverse().map(t => {
    const bn    = batchName(t.batchId, batches);
    const bColor = batches.find(b => b.id === t.batchId)?.color || '#8b5cf6';
    return `
      <div class="item-card test-card">
        <div class="item-card-header">
          <div class="avatar" style="background:#8b5cf6"><i class="ph ph-exam" style="font-size:1rem"></i></div>
          <div style="flex:1;min-width:0">
            <h4>${escHtml(t.title)}</h4>
            <div class="meta">${t.questions.length} question${t.questions.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        ${bn ? `<span class="tag" style="background:${bColor}22;color:${bColor}"><i class="ph ph-books"></i> ${escHtml(bn)}</span>` : ''}
        <div class="actions">
          <button class="btn-ghost" onclick="openAttempt('${t.id}')">
            <i class="ph ph-play"></i> Attempt
          </button>
          <button class="btn-danger" onclick="deleteTest('${t.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

/* ── ATTEMPT A TEST ────────────────────── */

function openAttempt(testId) {
  const test     = db.tests().find(t => t.id === testId);
  const students = db.students();
  if (!test) return;

  const inner = document.getElementById('attempt-modal-inner');
  inner.innerHTML = `
    <div class="modal-header">
      <h3>${escHtml(test.title)}</h3>
      <button onclick="closeModal('attempt-modal')"><i class="ph-bold ph-x"></i></button>
    </div>

    <div class="attempt-student-select">
      <div class="field-group">
        <label>Select Student</label>
        <div class="input-wrap"><i class="ph ph-student"></i>
          <select id="attempt-student">
            <option value="">— Choose student —</option>
            ${students.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div id="attempt-questions">
      ${test.questions.map((q, i) => `
        <div class="attempt-q-block">
          <div class="q-text">Q${i+1}. ${escHtml(q.text)}</div>
          ${Object.entries(q.options).map(([key, val]) => `
            <label class="option-label">
              <input type="radio" name="q${i}" value="${key}"/>
              <strong>${key}.</strong> ${escHtml(val)}
            </label>`).join('')}
        </div>`).join('')}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal('attempt-modal')">Cancel</button>
      <button class="btn-primary" onclick="submitAttempt('${testId}')">Submit Test</button>
    </div>`;

  openModal('attempt-modal');
}

function submitAttempt(testId) {
  const test      = db.tests().find(t => t.id === testId);
  const studentId = document.getElementById('attempt-student').value;
  if (!studentId) return showToast('⚠️ Please select a student.');

  let score = 0;
  const results = [];

  test.questions.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`)?.value || null;
    const isCorrect = selected === q.answer;
    if (isCorrect) score++;
    results.push({ selected, correct: q.answer, isCorrect });
  });

  const total = test.questions.length;
  const pct   = Math.round((score / total) * 100);

  // Save score
  const scores = db.scores();
  // Allow multiple attempts; keep all records
  scores.push({ id: uid(), studentId, testId, score, total, pct, createdAt: Date.now() });
  db.saveScores(scores);

  // Render results in modal
  const inner = document.getElementById('attempt-modal-inner');
  const studentName = db.students().find(s => s.id === studentId)?.name || 'Student';

  inner.innerHTML = `
    <div class="modal-header">
      <h3>Results — ${escHtml(test.title)}</h3>
      <button onclick="closeModal('attempt-modal');renderLeaderboard();renderBadges();"><i class="ph-bold ph-x"></i></button>
    </div>
    <div class="score-banner">
      <div class="score-num">${pct}%</div>
      <div class="score-label">${escHtml(studentName)} scored ${score} / ${total}</div>
    </div>
    <div id="attempt-answers">
      ${test.questions.map((q, i) => {
        const r = results[i];
        return `
          <div class="attempt-q-block">
            <div class="q-text">Q${i+1}. ${escHtml(q.text)}</div>
            ${Object.entries(q.options).map(([key, val]) => {
              let cls = '';
              if (key === q.answer) cls = 'correct';
              else if (key === r.selected && !r.isCorrect) cls = 'wrong';
              return `<label class="option-label ${cls}">
                <strong>${key}.</strong> ${escHtml(val)}
                ${key === q.answer ? ' ✓' : ''}
                ${key === r.selected && !r.isCorrect ? ' ✗' : ''}
              </label>`;
            }).join('')}
          </div>`;
      }).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="closeModal('attempt-modal');renderLeaderboard();renderBadges();">
        Done
      </button>
    </div>`;

  showToast(`🎉 ${studentName} scored ${score}/${total} (${pct}%)`);
}

/* ══════════════════════════════════════════
   13. LEADERBOARD
══════════════════════════════════════════ */

/** Build ranked array from students + scores */
function buildLeaderboard(students, scores) {
  return students.map(s => {
    const studentScores = scores.filter(sc => sc.studentId === s.id);
    const totalScore    = studentScores.reduce((acc, sc) => acc + sc.score, 0);
    const testsCount    = studentScores.length;
    const avgPct        = testsCount
      ? Math.round(studentScores.reduce((a,sc)=>a+sc.pct,0) / testsCount)
      : 0;
    return { ...s, totalScore, testsCount, avgPct };
  }).sort((a, b) => b.totalScore - a.totalScore || b.avgPct - a.avgPct);
}

function renderLeaderboard() {
  const students  = db.students();
  const scores    = db.scores();
  const ranked    = buildLeaderboard(students, scores);
  const batches   = db.batches();
  const list      = document.getElementById('leaderboard-list');

  if (!students.length) {
    list.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted)">No students yet.</div>`;
    return;
  }

  list.innerHTML = ranked.map((r, i) => {
    const rClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const bn     = batchName(r.batchId, batches);
    return `
      <div class="leaderboard-row">
        <div class="lb-rank ${rClass}">${i + 1}</div>
        <div class="avatar" style="background:${avatarBg(r.name)}">${initials(r.name)}</div>
        <div class="lb-info">
          <div class="lb-name">${escHtml(r.name)}</div>
          <div class="lb-meta">${bn ? escHtml(bn) + ' · ' : ''}${r.testsCount} test${r.testsCount !== 1?'s':''} · Avg ${r.avgPct}%</div>
        </div>
        <div style="text-align:right">
          <div class="lb-score">${r.totalScore}</div>
          <div class="lb-tests">points</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   14. BADGES
══════════════════════════════════════════ */

/** Compute which badges a student earns */
function computeBadges(studentId) {
  const scores  = db.scores().filter(s => s.studentId === studentId);
  const badges  = [];
  const maxPct  = scores.length ? Math.max(...scores.map(s => s.pct)) : 0;
  const attempts = scores.length;
  const firstPct = scores.length ? scores[0].pct : 0; // first recorded attempt

  if (maxPct === 100)    badges.push({ key:'perf',  icon:'🎯', label:'Perfect Score',       cls:'perf'  });
  if (maxPct >= 80)      badges.push({ key:'top',   icon:'🏆', label:'Top Performer',       cls:'top'   });
  if (attempts >= 3)     badges.push({ key:'con',   icon:'📚', label:'Consistent Learner',  cls:'con'   });
  if (firstPct >= 60)    badges.push({ key:'star',  icon:'⭐', label:'Rising Star',          cls:'star'  });

  return badges;
}

function renderBadges() {
  const students = db.students();
  const grid     = document.getElementById('badges-grid');
  const batches  = db.batches();

  if (!students.length) {
    grid.innerHTML = emptyState('ph-medal', 'No students yet.');
    return;
  }

  grid.innerHTML = students.map(s => {
    const badges = computeBadges(s.id);
    return `
      <div class="student-badges-card item-card">
        <div class="item-card-header">
          <div class="avatar" style="background:${avatarBg(s.name)}">${initials(s.name)}</div>
          <div>
            <h4>${escHtml(s.name)}</h4>
            <div class="meta">${escHtml(batchName(s.batchId, batches))}</div>
          </div>
        </div>
        <div>
          ${badges.length
            ? badges.map(b => `<span class="badge-pill ${b.cls}">${b.icon} ${b.label}</span>`).join('')
            : '<span class="no-badge">No badges yet — attempt some tests!</span>'}
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   15. DROPDOWN SYNC (batch selects)
══════════════════════════════════════════ */

/** Populate all batch <select> dropdowns */
function refreshBatchDropdowns() {
  const batches = db.batches();
  const opts = batches.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');

  // Student modal
  const studentBatch = document.getElementById('student-batch');
  if (studentBatch) {
    studentBatch.innerHTML = '<option value="">— Select Batch —</option>' + opts;
  }

  // Note modal
  const noteBatch = document.getElementById('note-batch');
  if (noteBatch) {
    noteBatch.innerHTML = '<option value="">— All Batches —</option>' + opts;
  }

  // Test modal
  const testBatch = document.getElementById('test-batch');
  if (testBatch) {
    testBatch.innerHTML = '<option value="">— Select Batch —</option>' + opts;
  }

  // Student filter
  const filterSel = document.getElementById('student-batch-filter');
  if (filterSel) {
    const curVal = filterSel.value;
    filterSel.innerHTML = '<option value="">All Batches</option>' + opts;
    filterSel.value = curVal;
  }
}

/* ══════════════════════════════════════════
   16. UTILITY FUNCTIONS
══════════════════════════════════════════ */

/** Get initials from a name */
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Deterministic avatar colour from name */
function avatarBg(name) {
  let hash = 0;
  for (let c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return BATCH_COLORS[Math.abs(hash) % BATCH_COLORS.length];
}

/** Lookup batch name by id */
function batchName(batchId, batches) {
  return batches?.find(b => b.id === batchId)?.name || '';
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/** Generic empty state markup */
function emptyState(icon, msg) {
  return `<div class="empty-state">
    <i class="ph ${icon}"></i>
    <p>${msg}</p>
  </div>`;
}

/* ══════════════════════════════════════════
   17. OVERRIDE "New Test" BUTTON
       (to reset builder before opening)
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Intercept the "Create Test" button in page header
  const testSection = document.getElementById('section-tests');
  if (testSection) {
    const btn = testSection.querySelector('.btn-primary');
    if (btn) {
      btn.setAttribute('onclick', '');
      btn.addEventListener('click', () => {
        questionCount = 0;
        document.getElementById('questions-builder').innerHTML = '';
        document.getElementById('test-title').value = '';
        document.getElementById('test-batch').value = '';
        openModal('test-modal');
        addQuestionField();
        refreshBatchDropdowns();
      });
    }
  }

  // Check if user is already logged in (session persists via localStorage)
  const user = db.currentUser();
  if (user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    bootApp();
  }

  // Refresh dropdowns whenever a modal opens (simple approach)
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('transitionend', () => {});
  });

  // Refresh dropdowns on open
  const origOpen = window.openModal;
  window.openModal = function(id) {
    origOpen(id);
    refreshBatchDropdowns();
  };
});

/* ══════════════════════════════════════════
   18. KEYBOARD SHORTCUT: ESC closes modals
══════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});
