import { readFile } from 'node:fs/promises';
import { questionBank } from '../questions.js';

const DEFAULT_INPUT = new URL('../data/proformatrans-test1.questions.json', import.meta.url);

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"'¿?¡!.,:;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2));
}

function jaccard(leftValue, rightValue) {
  const left = tokens(leftValue);
  const right = tokens(rightValue);
  const union = new Set([...left, ...right]);

  if (union.size === 0) {
    return 0;
  }

  return [...left].filter((token) => right.has(token)).length / union.size;
}

function answerText(question) {
  return question.answers.map((answer) => answer.original).join(' | ');
}

function correctAnswer(question) {
  return question.answers[question.correctIndex]?.original ?? '';
}

const inputPath = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : DEFAULT_INPUT;
const incomingQuestions = JSON.parse(await readFile(inputPath, 'utf8'));
const incomingSources = new Set(incomingQuestions.map((question) => question.source).filter(Boolean));
const existingQuestions = questionBank.filter((question) => !incomingSources.has(question.source));
const candidates = [];

for (const incoming of incomingQuestions) {
  for (const existing of existingQuestions) {
    const qScore = jaccard(incoming.q, existing.q);
    const answerScore = jaccard(answerText(incoming), answerText(existing));
    const score = qScore * 0.75 + answerScore * 0.25;
    const exactQuestion = normalize(incoming.q) === normalize(existing.q);
    const exactCorrect = normalize(correctAnswer(incoming)) === normalize(correctAnswer(existing));

    if (exactQuestion || score >= 0.58 || (qScore >= 0.45 && exactCorrect)) {
      candidates.push({
        score,
        qScore,
        answerScore,
        exactQuestion,
        exactCorrect,
        existing,
        incoming,
      });
    }
  }
}

candidates.sort((left, right) => right.score - left.score);

if (candidates.length === 0) {
  console.log('No duplicate candidates found.');
  process.exit(0);
}

for (const candidate of candidates) {
  console.log('\n--- Duplicate candidate ---');
  console.log(`score: ${candidate.score.toFixed(3)} question: ${candidate.qScore.toFixed(3)} answers: ${candidate.answerScore.toFixed(3)}`);
  console.log(`existing: ${candidate.existing.id} (${candidate.existing.source}, module ${candidate.existing.module})`);
  console.log(`  q: ${candidate.existing.q}`);
  console.log(`  correct: ${correctAnswer(candidate.existing)}`);
  console.log(`incoming: ${candidate.incoming.id} (${candidate.incoming.source}, module ${candidate.incoming.module})`);
  console.log(`  q: ${candidate.incoming.q}`);
  console.log(`  correct: ${correctAnswer(candidate.incoming)}`);
}
