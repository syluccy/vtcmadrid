The app is a simple quiz designed to help users practice for the Madrid VTC exam.
After submitting an answer, it gives real-time feedback on the correct answers.
Once the exam is finished, it shows whether we would have passed the real exam in a live situation.
After completing the exam, there is also an option to review either only the incorrectly answered questions or both the incorrect and correct ones.

Resources: https://www.comunidad.madrid/servicios/transporte/pruebas-conductor-vtc

The primary language is Castellano (ES), but there are Hungarian aids available. During the exam, the translation of the question can be viewed, and after the exam both the question and the answer are translated into Hungarian.

## Question bank

Current total: 315 questions.

- Module I: 104 questions
- Module II: 71 questions
- Module III: 69 questions
- Module IV: 71 questions

## Adding new questions

New questions should keep the same structure as `questions.js`: Spanish question text in `q`, Hungarian translation in `hu`, four answer options with `original` and `hu`, a `correctIndex`, a `module` value of `I`, `II`, `III`, or `IV`, and a `source`.

For the Proformatrans test 1 material, add the prepared records to `data/proformatrans-test1.questions.json`. Every imported record is forced to use:

```js
"source": "proformatrans-test1"
```

Validate the existing bank:

```bash
node scripts/validate-questions.mjs
```

Check duplicate candidates before appending:

```bash
node scripts/find-duplicate-candidates.mjs
```

Append the prepared Proformatrans records to `questions.js`:

```bash
node scripts/append-questions.mjs
```
