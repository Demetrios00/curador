/**
 * Testes unitários da continuidade de conversa no agendamento (18/10/2026).
 * Rodar: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSchedulingContinuation, parsePendingContext } from "../src/agents/appointments/scheduleAppointment";

test("continuação: resposta só com os dados que faltavam", () => {
  assert.equal(isSchedulingContinuation("Ortopedia, dia 19 às 14horas"), true);
  assert.equal(isSchedulingContinuation("no Hospital Vida Caps"), true);
  assert.equal(isSchedulingContinuation("19/10 as 14h com qualquer médico"), true);
});

test("não é continuação: pergunta sobre outro assunto ou desistência", () => {
  assert.equal(isSchedulingContinuation("Quais são meus agendamentos?"), false);
  assert.equal(isSchedulingContinuation("Meu hemograma já ficou pronto?"), false);
  assert.equal(isSchedulingContinuation("deixa pra lá"), false);
  assert.equal(isSchedulingContinuation("cancelar"), false);
});

test("pendingContext: aceita só o formato esperado", () => {
  assert.deepEqual(parsePendingContext({ kind: "schedule", text: " consulta no Vida Caps " }), { kind: "schedule", text: "consulta no Vida Caps" });
  assert.equal(parsePendingContext({ kind: "outro", text: "x" }), null);
  assert.equal(parsePendingContext({ kind: "schedule", text: "" }), null);
  assert.equal(parsePendingContext({ kind: "schedule", text: "a".repeat(1001) }), null);
  assert.equal(parsePendingContext("texto solto"), null);
  assert.equal(parsePendingContext(undefined), null);
});
