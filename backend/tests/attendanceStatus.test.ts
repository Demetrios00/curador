/**
 * Teste unitário da regra de status exibido com confirmação de presença (18/10/2026).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDisplayStatus } from "../src/agents/appointments/appointmentsAgent";
import type { AppointmentRecord } from "../src/repositories/appointments.repository";

const now = Date.parse("2026-10-18T15:00:00Z");
const day = 24 * 60 * 60 * 1000;
const appt = (status: string, offsetMs: number) =>
  ({ status, date: new Date(now + offsetMs).toISOString() } as unknown as AppointmentRecord);

test("futuro aberto → Marcado", () => {
  assert.equal(computeDisplayStatus(appt("agendado", day), now), "Marcado");
  assert.equal(computeDisplayStatus(appt("confirmado", day), now), "Marcado");
});

test("passado aberto dentro do prazo → Aguardando confirmação (não Perdido)", () => {
  assert.equal(computeDisplayStatus(appt("confirmado", -2 * 60 * 60 * 1000), now), "Aguardando confirmação");
  assert.equal(computeDisplayStatus(appt("agendado", -6 * day), now), "Aguardando confirmação");
});

test("passado aberto após 7 dias sem resposta → Perdido", () => {
  assert.equal(computeDisplayStatus(appt("agendado", -8 * day), now), "Perdido");
});

test("status declarados pelo paciente prevalecem", () => {
  assert.equal(computeDisplayStatus(appt("concluido", -1 * day), now), "Realizado");
  assert.equal(computeDisplayStatus(appt("perdido", -1 * day), now), "Perdido");
  assert.equal(computeDisplayStatus(appt("cancelado", day), now), "Cancelado");
});
