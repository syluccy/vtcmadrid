import { RULES, questionBank } from './questions.js';

const app = document.getElementById('app');
const STORAGE_KEY = 'vtc_exam_state';

const state = {
  examQuestions: [],
  answers: {},
  lockedAnswers: {},
  submitted: false,
  currentIndex: 0,
  resultsFilter: 'wrong',
};

const moduleOrder = ['I', 'II', 'III', 'IV'];

const moduleTitles = {
  I: 'Módulo I',
  II: 'Módulo II',
  III: 'Módulo III',
  IV: 'Módulo IV',
};

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function saveState() {
  const snapshot = {
    examQuestions: state.examQuestions,
    answers: state.answers,
    lockedAnswers: state.lockedAnswers,
    submitted: state.submitted,
    currentIndex: state.currentIndex,
    resultsFilter: state.resultsFilter,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.examQuestions) || parsed.examQuestions.length === 0) {
      return false;
    }

    state.examQuestions = parsed.examQuestions;
    state.answers = parsed.answers ?? {};
    state.lockedAnswers = parsed.lockedAnswers ?? {};
    state.submitted = Boolean(parsed.submitted);
    state.currentIndex = Number.isInteger(parsed.currentIndex) ? parsed.currentIndex : 0;
    state.resultsFilter = parsed.resultsFilter === 'all' ? 'all' : 'wrong';

    if (state.currentIndex < 0) state.currentIndex = 0;
    if (state.currentIndex >= state.examQuestions.length) {
      state.currentIndex = state.examQuestions.length - 1;
    }

    return true;
  } catch {
    return false;
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function getQuestionsByModule(moduleKey) {
  return questionBank.filter((q) => q.module === moduleKey);
}

function buildExam() {
  const selected = [];

  for (const moduleKey of moduleOrder) {
    const pool = getQuestionsByModule(moduleKey);
    const needed = RULES[moduleKey]?.take ?? 0;

    if (pool.length < needed) {
      throw new Error(
        `${moduleTitles[moduleKey]} modulban nincs elég kérdés. Megvan: ${pool.length}, kellene: ${needed}`
      );
    }

    selected.push(...shuffle(pool).slice(0, needed));
  }

  state.examQuestions = shuffle(selected);
  state.answers = {};
  state.lockedAnswers = {};
  state.submitted = false;
  state.currentIndex = 0;
  state.resultsFilter = 'wrong';
  saveState();
}

function isExamComplete() {
  return state.examQuestions.every((q) => Number.isInteger(state.answers[q.id]));
}

function getFirstUnansweredIndex() {
  return state.examQuestions.findIndex((q) => !Number.isInteger(state.answers[q.id]));
}

function countCorrectForQuestionSet(questions) {
  let correct = 0;
  for (const q of questions) {
    if (state.lockedAnswers[q.id] === q.correctIndex) {
      correct += 1;
    }
  }
  return correct;
}

function countCorrectOverall() {
  return countCorrectForQuestionSet(state.examQuestions);
}

function countCorrectForModule(moduleKey) {
  return countCorrectForQuestionSet(
    state.examQuestions.filter((q) => q.module === moduleKey)
  );
}

function groupExamByModule() {
  return {
    I: state.examQuestions.filter((q) => q.module === 'I'),
    II: state.examQuestions.filter((q) => q.module === 'II'),
    III: state.examQuestions.filter((q) => q.module === 'III'),
    IV: state.examQuestions.filter((q) => q.module === 'IV'),
  };
}

function isQuestionCorrect(question) {
  return state.lockedAnswers[question.id] === question.correctIndex;
}

function getFilteredQuestions(questions) {
  if (state.resultsFilter === 'all') return questions;
  return questions.filter((q) => !isQuestionCorrect(q));
}

function lockCurrentAnswer() {
  const question = state.examQuestions[state.currentIndex];
  if (!question) return;

  const selected = state.answers[question.id];
  if (Number.isInteger(selected)) {
    state.lockedAnswers[question.id] = selected;
    saveState();
  }
}

function renderLiveStats() {
  const totalCorrect = countCorrectOverall();

  return `
    <section class="live-stats">
      <div class="live-stats-main">
        <div class="live-stat-card">
          <div class="live-stat-label">Helyes válaszok eddig</div>
          <div class="live-stat-value">${totalCorrect} / ${state.examQuestions.length}</div>
        </div>
      </div>

      <div class="live-stats-modules">
        ${moduleOrder.map((moduleKey) => {
          const correct = countCorrectForModule(moduleKey);
          const rule = RULES[moduleKey];
          return `
            <div class="module-mini-card">
              <div class="module-mini-title">${escapeHtml(moduleTitles[moduleKey])}</div>
              <div class="module-mini-value">${correct} / ${rule.take}</div>
              <div class="module-mini-pass">minimum ${rule.pass}</div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderQuestionTranslation(question) {
  if (!question.hu) return '';
  return `
    <details class="translation-toggle">
      <summary>Magyar fordítás</summary>
      <div class="question-hu">${escapeHtml(question.hu)}</div>
    </details>
  `;
}

function renderExamView() {
  const question = state.examQuestions[state.currentIndex];
  const chosenIndex = state.answers[question.id];
  const isLastQuestion = state.currentIndex === state.examQuestions.length - 1;
  const progressPercent = Math.round(((state.currentIndex + 1) / state.examQuestions.length) * 100);

  const answersHtml = question.answers
    .map((answer, index) => {
      const checked = chosenIndex === index ? 'checked' : '';
      const inputId = `${question.id}-${index}`;

      return `
        <label class="answer-option" for="${inputId}">
          <input
            type="radio"
            id="${inputId}"
            name="${escapeHtml(question.id)}"
            value="${index}"
            ${checked}
          />
          <span>
            <strong>${String.fromCharCode(65 + index)}.</strong>
            ${escapeHtml(answer.original)}
          </span>
        </label>
      `;
    })
    .join('');

  app.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div>
          <h1>VTC Vizsgagyakorló</h1>
          <p>Kérdés ${state.currentIndex + 1} / ${state.examQuestions.length}</p>
        </div>

        <div class="topbar-actions">
          <button id="new-exam-btn" class="secondary-btn">Új teszt</button>
        </div>
      </header>

      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${progressPercent}%"></div>
        </div>
      </div>

      <article class="question-card single-question">
        <div class="question-meta">
          <span class="module-badge">${escapeHtml(moduleTitles[question.module])}</span>
          <span class="question-number">#${state.currentIndex + 1}</span>
        </div>

        <h2 class="question-title">${escapeHtml(question.q)}</h2>
        ${renderQuestionTranslation(question)}

        <div class="answers-list">
          ${answersHtml}
        </div>
      </article>

      <div class="nav-actions">
        <button id="prev-btn" class="secondary-btn" ${state.currentIndex === 0 ? 'disabled' : ''}>
          Előző
        </button>

        ${
          isLastQuestion
            ? `<button id="finish-btn" class="primary-btn">Teszt befejezése</button>`
            : `<button id="next-btn" class="primary-btn">Következő</button>`
        }
      </div>

      ${renderLiveStats()}
    </div>
  `;

  document.querySelectorAll(`input[name="${CSS.escape(question.id)}"]`).forEach((input) => {
    input.addEventListener('change', (event) => {
      state.answers[question.id] = Number(event.target.value);
      saveState();
      renderExamView();
    });
  });

  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      saveState();
      renderExamView();
    }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    lockCurrentAnswer();

    if (state.currentIndex < state.examQuestions.length - 1) {
      state.currentIndex += 1;
      saveState();
      renderExamView();
    }
  });

  document.getElementById('finish-btn')?.addEventListener('click', () => {
    lockCurrentAnswer();

    const firstUnanswered = getFirstUnansweredIndex();

    if (firstUnanswered !== -1) {
      state.currentIndex = firstUnanswered;
      saveState();
      alert(`Van még megválaszolatlan kérdés. Átugrottam az első kihagyott kérdéshez (#${firstUnanswered + 1}).`);
      renderExamView();
      return;
    }

    state.submitted = true;
    state.resultsFilter = 'wrong';
    saveState();
    renderResultsView();
  });

  document.getElementById('new-exam-btn')?.addEventListener('click', () => {
    clearState();
    buildExam();
    renderExamView();
  });
}

function createResultAnswerLine(answer, index, question, userAnswer) {
  const isCorrect = index === question.correctIndex;
  const isChosen = index === userAnswer;

  let className = 'result-answer';
  if (isCorrect) className += ' correct';
  if (isChosen && !isCorrect) className += ' wrong';
  if (isChosen) className += ' chosen';

  return `
    <li class="${className}">
      <div>
        <strong>${String.fromCharCode(65 + index)}.</strong>
        ${escapeHtml(answer.original)}
      </div>
      ${answer.hu ? `
        <details class="translation-toggle answer-toggle">
          <summary>Magyar fordítás</summary>
          <div class="result-answer-hu">${escapeHtml(answer.hu)}</div>
        </details>
      ` : ''}
      <div class="result-flags">
        ${isChosen ? '<span class="flag chosen">Te ezt jelölted</span>' : ''}
        ${isCorrect ? '<span class="flag correct">Helyes válasz</span>' : ''}
      </div>
    </li>
  `;
}

function createResultCard(question, indexInModule) {
  const userAnswer = state.lockedAnswers[question.id];
  const isCorrect = userAnswer === question.correctIndex;

  const answersHtml = question.answers
    .map((answer, idx) => createResultAnswerLine(answer, idx, question, userAnswer))
    .join('');

  return `
    <article class="result-card ${isCorrect ? 'ok' : 'bad'}">
      <div class="result-card-head">
        <span class="question-number">#${indexInModule}</span>
        <span class="result-status ${isCorrect ? 'ok' : 'bad'}">
          ${isCorrect ? 'Helyes' : 'Hibás'}
        </span>
      </div>

      <div class="result-question-original">${escapeHtml(question.q)}</div>
      ${question.hu ? `
        <details class="translation-toggle">
          <summary>Magyar fordítás</summary>
          <div class="result-question-hu">${escapeHtml(question.hu)}</div>
        </details>
      ` : ''}

      <ol class="result-answers">
        ${answersHtml}
      </ol>
    </article>
  `;
}

function renderResultsView() {
  const grouped = groupExamByModule();

  const moduleSummaries = moduleOrder.map((moduleKey) => {
    const allQuestions = grouped[moduleKey];
    const filteredQuestions = getFilteredQuestions(allQuestions);
    const correct = countCorrectForModule(moduleKey);
    const take = RULES[moduleKey].take;
    const pass = RULES[moduleKey].pass;
    const passed = correct >= pass;

    return {
      moduleKey,
      correct,
      take,
      pass,
      passed,
      questions: filteredQuestions,
      totalQuestions: allQuestions.length,
      shownQuestions: filteredQuestions.length,
    };
  });

  const overallPassed = moduleSummaries.every((m) => m.passed);

  const summaryHtml = moduleSummaries
    .map(
      (m) => `
        <div class="summary-card ${m.passed ? 'pass' : 'fail'}">
          <h3>${escapeHtml(moduleTitles[m.moduleKey])}</h3>
          <p>${m.correct} / ${m.take}</p>
          <p>Minimum: ${m.pass}</p>
          <strong>${m.passed ? 'Átmentél' : 'Nem mentél át'}</strong>
        </div>
      `
    )
    .join('');

  const detailsHtml = moduleSummaries
    .map((moduleSummary) => {
      const resultCards = moduleSummary.questions.length
        ? moduleSummary.questions.map((q, idx) => createResultCard(q, idx + 1)).join('')
        : `
          <article class="result-card ok">
            <div class="result-card-head">
              <span class="question-number">0</span>
              <span class="result-status ok">Nincs találat</span>
            </div>
            <div class="result-question-original">
              ${
                state.resultsFilter === 'wrong'
                  ? 'Ebben a modulban nincs hibás válasz.'
                  : 'Ebben a modulban nincs megjeleníthető kérdés.'
              }
            </div>
          </article>
        `;

      return `
        <section class="module-section">
          <div class="module-header">
            <h2>${escapeHtml(moduleTitles[moduleSummary.moduleKey])}</h2>
            <p>
              ${moduleSummary.correct} / ${moduleSummary.take}
              • minimum ${moduleSummary.pass}
              • <strong>${moduleSummary.passed ? 'Átmentél' : 'Nem mentél át'}</strong>
            </p>
          </div>
          <div class="result-grid">
            ${resultCards}
          </div>
        </section>
      `;
    })
    .join('');

  app.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div>
          <h1>Eredmények</h1>
          <p class="final-status ${overallPassed ? 'pass' : 'fail'}">
            ${overallPassed ? 'Összesítve: Átmentél' : 'Összesítve: Nem mentél át'}
          </p>
        </div>
        <div class="topbar-actions">
          <button id="filter-wrong-btn" class="${state.resultsFilter === 'wrong' ? 'primary-btn' : 'secondary-btn'}">Csak rossz válaszok</button>
          <button id="filter-all-btn" class="${state.resultsFilter === 'all' ? 'primary-btn' : 'secondary-btn'}">Minden válasz</button>
          <button id="retry-btn" class="secondary-btn">Új teszt</button>
          <button id="review-btn" class="primary-btn">Vissza a teszthez</button>
        </div>
      </header>

      <section class="summary-grid">
        ${summaryHtml}
      </section>

      ${detailsHtml}
    </div>
  `;

  document.getElementById('filter-wrong-btn')?.addEventListener('click', () => {
    state.resultsFilter = 'wrong';
    saveState();
    renderResultsView();
  });

  document.getElementById('filter-all-btn')?.addEventListener('click', () => {
    state.resultsFilter = 'all';
    saveState();
    renderResultsView();
  });

  document.getElementById('retry-btn')?.addEventListener('click', () => {
    clearState();
    buildExam();
    renderExamView();
  });

  document.getElementById('review-btn')?.addEventListener('click', () => {
    state.submitted = false;
    saveState();
    renderExamView();
  });
}

function init() {
  try {
    const restored = loadState();

    if (!restored) {
      buildExam();
    }

    if (state.submitted) {
      renderResultsView();
    } else {
      renderExamView();
    }
  } catch (error) {
    app.innerHTML = `
      <div class="page">
        <h1>Hiba</h1>
        <pre>${escapeHtml(error.message)}</pre>
      </div>
    `;
    console.error(error);
  }
}

init();
