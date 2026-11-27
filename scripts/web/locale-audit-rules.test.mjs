import assert from "node:assert/strict";
import test from "node:test";

import {
  hasQuestionMarkReplacementText,
} from "./locale-audit-rules.mjs";

test("rejects long and question-mark-only translation replacement debris", () => {
  assert.equal(hasQuestionMarkReplacementText("A visible ??? replacement"), true);
  assert.equal(hasQuestionMarkReplacementText("?? ??"), true);
  assert.equal(hasQuestionMarkReplacementText("????????"), true);
});

test("rejects question-mark replacement text embedded inside words", () => {
  assert.equal(hasQuestionMarkReplacementText("Reinicia la aplicaci?n."), true);
  assert.equal(hasQuestionMarkReplacementText("Bilinmeyen bir hata olu?tu."), true);
  assert.equal(hasQuestionMarkReplacementText("Falha na inicializa??o"), true);
});

test("allows natural questions and non-string values", () => {
  assert.equal(hasQuestionMarkReplacementText("Delete account?"), false);
  assert.equal(hasQuestionMarkReplacementText("What? Why?"), false);
  assert.equal(hasQuestionMarkReplacementText("Ready? Next round."), false);
  assert.equal(hasQuestionMarkReplacementText("¿Listo?"), false);
  assert.equal(hasQuestionMarkReplacementText(null), false);
});
