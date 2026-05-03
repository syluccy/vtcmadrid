import { readFile, writeFile } from 'node:fs/promises';
import { questionBank } from '../questions.js';

const VALID_MODULES = new Set(['I', 'II', 'III', 'IV']);
const DEFAULT_INPUT = new URL('../data/proformatrans-test1.questions.json', import.meta.url);
const QUESTIONS_FILE = new URL('../questions.js', import.meta.url);
const SOURCE = 'proformatrans-test1';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeQuestion(question, index) {
  return {
    ...question,
    source: SOURCE,
    id: question.id || `${SOURCE}-${String(index + 1).padStart(3, '0')}`,
  };
}

function validateQuestion(question, index, existingIds, incomingIds) {
  const label = question?.id ? `${question.id}` : `incoming question ${index + 1}`;
  const errors = [];

  if (!isNonEmptyString(question?.id)) {
    errors.push(`${label}: missing id`);
  } else if (existingIds.has(question.id) || incomingIds.has(question.id)) {
    errors.push(`${label}: duplicate id`);
  } else {
    incomingIds.add(question.id);
  }

  if (question?.source !== SOURCE) {
    errors.push(`${label}: source must be ${SOURCE}`);
  }

  if (!VALID_MODULES.has(question?.module)) {
    errors.push(`${label}: module must be one of I, II, III, IV`);
  }

  if (!isNonEmptyString(question?.q)) {
    errors.push(`${label}: missing Spanish question text in q`);
  }

  if (!isNonEmptyString(question?.hu)) {
    errors.push(`${label}: missing Hungarian question translation in hu`);
  }

  if (!Array.isArray(question?.answers) || question.answers.length !== 4) {
    errors.push(`${label}: answers must contain exactly 4 options`);
    return errors;
  }

  question.answers.forEach((answer, answerIndex) => {
    if (!isNonEmptyString(answer?.original)) {
      errors.push(`${label}: answer ${answerIndex} missing original`);
    }

    if (!isNonEmptyString(answer?.hu)) {
      errors.push(`${label}: answer ${answerIndex} missing hu translation`);
    }
  });

  if (
    !Number.isInteger(question?.correctIndex) ||
    question.correctIndex < 0 ||
    question.correctIndex >= question.answers.length
  ) {
    errors.push(`${label}: correctIndex must point to one of the 4 answers`);
  }

  return errors;
}

const inputPath = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : DEFAULT_INPUT;
const parsed = JSON.parse(await readFile(inputPath, 'utf8'));

if (!Array.isArray(parsed)) {
  throw new Error('Input file must contain a JSON array of questions.');
}

const existingIds = new Set(questionBank.map((question) => question.id));
const incomingIds = new Set();
const incomingQuestions = parsed.map(normalizeQuestion);
const errors = incomingQuestions.flatMap((question, index) =>
  validateQuestion(question, index, existingIds, incomingIds)
);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

if (incomingQuestions.length === 0) {
  console.log('No incoming questions to append.');
  process.exit(0);
}

const source = await readFile(QUESTIONS_FILE, 'utf8');
const appendedQuestions = incomingQuestions
  .map((question) => `  ${JSON.stringify(question, null, 2).replace(/\n/g, '\n  ')}`)
  .join(',\n');
const updated = source.replace(/,?\s*\n\];\s*$/, `,\n${appendedQuestions}\n];`);

if (updated === source) {
  throw new Error('Could not find the questionBank closing bracket.');
}

await writeFile(QUESTIONS_FILE, updated);
console.log(`Appended ${incomingQuestions.length} ${SOURCE} questions.`);
