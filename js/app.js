(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = { studied: 'pds_viva_studied_v3', saved: 'pds_viva_saved_v3' };
  const priorityMeta = {
    HIGH: { label: '🔥 HIGH', className: 'high', rank: 0 },
    MEDIUM: { label: '⭐ MEDIUM', className: 'medium', rank: 1 },
    LOW: { label: '🔹 LOW', className: 'low', rank: 2 },
    TRICKY: { label: '⚠️ TRICKY', className: 'tricky', rank: 3 },
    RAPID: { label: '📌 RAPID', className: 'rapid', rank: 4 }
  };

  const safeGet = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };
  const safeSet = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  let studied = new Set(safeGet(STORAGE.studied));
  let saved = new Set(safeGet(STORAGE.saved));
  let activeFilter = 'all';
  let searchTerm = '';
  let quizPool = [];
  let quizIndex = 0;
  let quizScore = 0;
  let quizReviewed = new Map();

  const validIds = new Set(QUESTIONS.map(q => q.id));
  studied = new Set([...studied].filter(id => validIds.has(Number(id))).map(Number));
  saved = new Set([...saved].filter(id => validIds.has(Number(id))).map(Number));

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const normalized = value => String(value ?? '').toLowerCase().trim();
  const searchable = q => normalized([q.question, q.answer, q.topic, q.unit, `unit ${q.unit}`, ...q.keywords, q.followUp || ''].join(' '));

  function highlight(value) {
    const safe = esc(value);
    if (!searchTerm) return safe;
    const term = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${term})`, 'gi'), '<mark>$1</mark>');
  }

  function persist() {
    safeSet(STORAGE.studied, [...studied]);
    safeSet(STORAGE.saved, [...saved]);
  }

  function card(q) {
    const meta = priorityMeta[q.priority] || priorityMeta.MEDIUM;
    const isStudied = studied.has(q.id);
    const isSaved = saved.has(q.id);
    return `<article class="question-card ${isStudied ? 'is-studied' : ''}" data-question-id="${q.id}">
      <div class="card-top"><span class="badge ${meta.className}">${meta.label}</span><span class="question-number">Q${q.id}</span></div>
      <p class="card-topic">UNIT ${q.unit} · ${esc(q.topic)}</p>
      <h3>${highlight(q.question)}</h3>
      <div class="answer-block"><span class="answer-label">ANSWER</span><p>${highlight(q.answer)}</p></div>
      ${q.code ? `<div class="code-label">CODE</div><pre class="code-block"><code>${esc(q.code)}</code></pre>` : ''}
      ${q.followUp ? `<div class="follow-up"><strong>Examiner may ask next:</strong> ${highlight(q.followUp)}</div>` : ''}
      <div class="keyword-list">${q.keywords.map(k => `<span>${highlight(k)}</span>`).join('')}</div>
      <div class="card-actions">
        <button class="small-button ${isStudied ? 'active' : ''}" data-action="study" data-id="${q.id}" type="button" aria-pressed="${isStudied}">${isStudied ? '✓ Studied' : 'Mark studied'}</button>
        <button class="small-button ${isSaved ? 'active' : ''}" data-action="save" data-id="${q.id}" type="button" aria-pressed="${isSaved}">${isSaved ? '★ Saved' : '☆ Save'}</button>
      </div>
    </article>`;
  }

  function renderList(list, selector) {
    const target = $(selector);
    if (!target) return;
    target.innerHTML = list.map(card).join('');
  }

  function groupedByUnit(list) {
    return UNITS.map(unit => ({ unit, questions: list.filter(q => q.unit === unit.id) })).filter(group => group.questions.length);
  }

  function renderGrouped(list, selector) {
    const target = $(selector);
    if (!target) return;
    target.innerHTML = groupedByUnit(list).map(({ unit, questions }) => `<div class="group-block"><div class="group-heading"><span>UNIT ${unit.id}</span><h3>${esc(unit.title)}</h3><b>${questions.length} questions</b></div><div class="question-grid">${questions.map(card).join('')}</div></div>`).join('');
  }

  function renderTop20() { renderList(QUESTIONS.filter(q => q.id <= 20), '#topGrid'); }
  function renderImportant() { renderGrouped(QUESTIONS.filter(q => q.priority === 'MEDIUM'), '#importantGrid'); }
  function renderLow() { renderGrouped(QUESTIONS.filter(q => q.priority === 'LOW'), '#lowGrid'); }
  function renderTricky() { renderGrouped(QUESTIONS.filter(q => q.priority === 'TRICKY'), '#trickyGrid'); }
  function renderRapid() { renderGrouped(QUESTIONS.filter(q => q.priority === 'RAPID'), '#rapidGrid'); }

  function renderUnits() {
    $('#unitsGrid').innerHTML = UNITS.map(unit => {
      const questions = QUESTIONS.filter(q => q.unit === unit.id);
      const done = questions.filter(q => studied.has(q.id)).length;
      const percent = questions.length ? Math.round(done / questions.length * 100) : 0;
      return `<article class="unit-card" data-unit="${unit.id}" tabindex="0" role="button" aria-label="Open Unit ${unit.id} questions">
        <div class="unit-number">0${unit.id}</div>
        <div class="unit-content"><span>UNIT ${unit.id}</span><h3>${esc(unit.title)}</h3><p>${unit.topics.map(esc).join(' · ')}</p><div class="unit-meta"><b>${questions.length} questions</b><span>${done}/${questions.length} studied</span></div><div class="unit-bar"><i style="width:${percent}%"></i></div></div>
      </article>`;
    }).join('');
  }

  function renderFilters() {
    const options = [['all', 'All'], ['HIGH', '🔥 High'], ['MEDIUM', '⭐ Medium'], ['LOW', '🔹 Low'], ['TRICKY', '⚠️ Tricky'], ['RAPID', '📌 Rapid'], ...UNITS.map(u => [String(u.id), `Unit ${u.id}`])];
    $('#filters').innerHTML = options.map(([value, label]) => `<button class="filter-button ${activeFilter === value ? 'active' : ''}" data-filter="${value}" type="button" aria-pressed="${activeFilter === value}">${label}</button>`).join('');
  }

  function getFilteredQuestions() {
    return QUESTIONS.filter(q => {
      const filterOk = activeFilter === 'all' || q.priority === activeFilter || String(q.unit) === activeFilter;
      return filterOk && (!searchTerm || searchable(q).includes(searchTerm));
    });
  }

  function renderBank() {
    const list = getFilteredQuestions().slice();
    const sort = $('#sort').value;
    const rank = Object.fromEntries(Object.entries(priorityMeta).map(([key, meta]) => [key, meta.rank]));
    if (sort === 'priority') list.sort((a, b) => rank[a.priority] - rank[b.priority] || a.id - b.id);
    if (sort === 'unit') list.sort((a, b) => a.unit - b.unit || a.id - b.id);
    if (sort === 'unanswered') list.sort((a, b) => Number(studied.has(a.id)) - Number(studied.has(b.id)) || a.id - b.id);
    if (sort === 'number') list.sort((a, b) => a.id - b.id);
    renderList(list, '#bankGrid');
    $('#resultCount').textContent = `${list.length} question${list.length === 1 ? '' : 's'}`;
    $('#savedCount').textContent = `${saved.size} saved`;
    $('#empty').hidden = list.length !== 0;
  }

  function renderDashboard() {
    const total = QUESTIONS.length;
    const done = QUESTIONS.filter(q => studied.has(q.id)).length;
    const percent = total ? Math.round(done / total * 100) : 0;
    $('#total').textContent = total;
    $('#done').textContent = done;
    $('#remain').textContent = total - done;
    $('#high').textContent = QUESTIONS.filter(q => q.priority === 'HIGH').length;
    $('#pct').textContent = `${percent}%`;
    $('#overallFill').style.width = `${percent}%`;
    $('#unitprog').innerHTML = UNITS.map(unit => {
      const qs = QUESTIONS.filter(q => q.unit === unit.id);
      const d = qs.filter(q => studied.has(q.id)).length;
      const p = qs.length ? Math.round(d / qs.length * 100) : 0;
      return `<div class="progress-row"><div><b>Unit ${unit.id}</b><span>${d}/${qs.length}</span></div><div class="mini-track"><i style="width:${p}%"></i></div></div>`;
    }).join('');
  }

  function renderRevision() {
    $('#revisionGrid').innerHTML = REVISION.map(item => `<article class="revision-card"><span>${esc(item[0])}</span><h3>${esc(item[1])}</h3><ul>${item[2].map(point => `<li>${esc(point)}</li>`).join('')}</ul></article>`).join('');
    $('#comparisonGrid').innerHTML = COMPARISONS.map(comparison => `<article class="comparison-card"><h3>${esc(comparison[0])}</h3><div class="table-wrap"><table><tbody>${comparison[1].map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></article>`).join('');
  }

  function refreshAll() {
    persist();
    renderDashboard();
    renderTop20();
    renderImportant();
    renderLow();
    renderTricky();
    renderRapid();
    renderUnits();
    renderBank();
  }

  function setFilter(value) {
    activeFilter = value;
    renderFilters();
    renderBank();
    $('#bank').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function randomQuestion() {
    const list = getFilteredQuestions();
    if (!list.length) return;
    const q = list[Math.floor(Math.random() * list.length)];
    $('#bank').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.querySelector(`[data-question-id="${q.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  }

  function newQuizPool() {
    quizPool = [...QUESTIONS].sort(() => Math.random() - 0.5);
    quizIndex = 0;
    quizScore = 0;
    quizReviewed = new Map();
    renderQuiz();
  }

  function renderQuiz() {
    const q = quizPool[quizIndex];
    $('#quizResult').textContent = '';
    if (!q) {
      $('#qprogress').textContent = 'Question 0 / 0';
      $('#score').textContent = 'Score: 0';
      $('#quizUnit').textContent = 'Press Start / Restart Quiz.';
      $('#quizQuestion').textContent = 'Start the quiz to begin.';
      $('#quizAnswer').textContent = 'Answers are always visible by design.';
      $('#quizKeywords').innerHTML = '';
      $('#quizPrevious').disabled = true;
      $('#quizNext').disabled = true;
      $('#quizCorrect').disabled = true;
      $('#quizReview').disabled = true;
      return;
    }
    $('#qprogress').textContent = `Question ${quizIndex + 1} / ${quizPool.length}`;
    $('#score').textContent = `Score: ${quizScore}`;
    $('#quizUnit').textContent = `Unit ${q.unit} · ${q.topic}`;
    $('#quizQuestion').textContent = q.question;
    $('#quizAnswer').textContent = q.answer;
    $('#quizKeywords').innerHTML = q.keywords.map(k => `<span>${esc(k)}</span>`).join('');
    $('#quizPrevious').disabled = quizIndex === 0;
    $('#quizNext').disabled = quizIndex === quizPool.length - 1;
    $('#quizCorrect').disabled = quizReviewed.has(q.id);
    $('#quizReview').disabled = quizReviewed.has(q.id);
    const status = quizReviewed.get(q.id);
    if (status) $('#quizResult').textContent = status === 'correct' ? 'Marked correct.' : 'Marked for revision.';
  }

  function markQuiz(result) {
    const q = quizPool[quizIndex];
    if (!q || quizReviewed.has(q.id)) return;
    quizReviewed.set(q.id, result);
    if (result === 'correct') { quizScore += 1; studied.add(q.id); } else { studied.delete(q.id); }
    refreshAll();
    renderQuiz();
  }

  function nextQuiz() {
    if (!quizPool.length) return newQuizPool();
    if (quizIndex < quizPool.length - 1) { quizIndex += 1; renderQuiz(); return; }
    $('#quizResult').textContent = `Quiz complete — ${quizScore} / ${quizPool.length} correct.`;
  }

  function previousQuiz() {
    if (quizIndex > 0) { quizIndex -= 1; renderQuiz(); }
  }

  function randomQuiz() {
    if (!quizPool.length) return newQuizPool();
    quizIndex = Math.floor(Math.random() * quizPool.length);
    renderQuiz();
  }

  function handleCardAction(button) {
    const id = Number(button.dataset.id);
    if (!validIds.has(id)) return;
    if (button.dataset.action === 'study') studied.has(id) ? studied.delete(id) : studied.add(id);
    if (button.dataset.action === 'save') saved.has(id) ? saved.delete(id) : saved.add(id);
    refreshAll();
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-action]');
      if (action) { handleCardAction(action); return; }
      const filter = event.target.closest('[data-filter]');
      if (filter) { setFilter(filter.dataset.filter); return; }
      const unit = event.target.closest('[data-unit]');
      if (unit) { setFilter(String(unit.dataset.unit)); return; }
    });

    $('#search').addEventListener('input', event => { searchTerm = normalized(event.target.value); renderBank(); });
    $('#sort').addEventListener('change', renderBank);
    $('#randomQ').addEventListener('click', randomQuestion);
    $('#start').addEventListener('click', () => $('#top20').scrollIntoView({ behavior: 'smooth' }));
    $('#quizRestart').addEventListener('click', newQuizPool);
    $('#quizPrevious').addEventListener('click', previousQuiz);
    $('#quizNext').addEventListener('click', nextQuiz);
    $('#quizRandom').addEventListener('click', randomQuiz);
    $('#quizCorrect').addEventListener('click', () => markQuiz('correct'));
    $('#quizReview').addEventListener('click', () => markQuiz('review'));

    $('#menu').addEventListener('click', () => {
      const open = $('#nav').classList.toggle('open');
      $('#menu').setAttribute('aria-expanded', String(open));
      $('#menu').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    $$('#nav a').forEach(link => link.addEventListener('click', () => {
      $('#nav').classList.remove('open');
      $('#menu').setAttribute('aria-expanded', 'false');
      $('#menu').setAttribute('aria-label', 'Open navigation');
    }));

    document.addEventListener('keydown', event => {
      const tag = document.activeElement?.tagName;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      if (event.key === '/' && !typing) { event.preventDefault(); $('#search').focus(); }
      if (event.key.toLowerCase() === 'q' && !typing) $('#quiz').scrollIntoView({ behavior: 'smooth' });
      if (event.key.toLowerCase() === 'r' && !typing) randomQuestion();
      if (event.key.toLowerCase() === 'n' && !typing) nextQuiz();
      if (event.key.toLowerCase() === 'p' && !typing) previousQuiz();
    });

    $('#unitsGrid').addEventListener('keydown', event => {
      const unit = event.target.closest('[data-unit]');
      if (unit && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setFilter(String(unit.dataset.unit)); }
    });
  }

  function init() {
    renderFilters();
    renderRevision();
    bindEvents();
    refreshAll();
    newQuizPool();
  }

  init();
})();
