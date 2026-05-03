import { questionBank } from '../questions.js';

const VALID_MODULES = new Set(['I', 'II', 'III', 'IV']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateQuestion(question, index, seenIds) {
  const label = question?.id ? `${question.id}` : `question at index ${index}`;
  const errors = [];

  if (!isNonEmptyString(question?.id)) {
    errors.push(`${label}: missing id`);
  } else if (seenIds.has(question.id)) {
    errors.push(`${label}: duplicate id`);
  } else {
    seenIds.add(question.id);
  }

  if (!isNonEmptyString(question?.source)) {
    errors.push(`${label}: missing source`);
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

const seenIds = new Set();
const errors = [];

for (let index = 0; index < questionBank.length; index += 1) {
  if (!(index in questionBank)) {
    errors.push(`questionBank: empty slot at index ${index}`);
    continue;
  }

  errors.push(...validateQuestion(questionBank[index], index, seenIds));
}

const moduleCounts = questionBank.reduce((counts, question) => {
  counts[question.module] = (counts[question.module] ?? 0) + 1;
  return counts;
}, {});

console.log(
  JSON.stringify(
    {
      total: questionBank.length,
      modules: moduleCounts,
      errors: errors.length,
    },
    null,
    2
  )
);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
