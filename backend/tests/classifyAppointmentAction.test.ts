/**
 * Teste unitário (nível: unidade) do classificador determinístico
 * "consultar vs. criar" do Agente de Agendamentos.
 * Rodar: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAppointmentAction } from "../src/agents/appointments/scheduleAppointment";

const QUERY = [
  "Quais sao meus próximos agendamentos ?",
  "Quais os agendamentos que tenho ?",
  "Quando é minha consulta?",
  "Qual o status do meu exame?",
  "Tenho alguma consulta esta semana?",
];

const CREATE = [
  "Perfeito, agora crie um agendamentos de consulta sobre ortopedia no hospital vida caps para dia 19/10",
  "Crie um agendamentos de consulta",
  "Quero agendar uma consulta de cardiologia amanhã às 10h",
  "Desejo fazer um agendamento",
  "Marque um exame de sangue",
  "quero uma consulta",
];

for (const msg of QUERY) {
  test(`QUERY: ${msg}`, async () => {
    assert.equal(await classifyAppointmentAction(msg), "QUERY");
  });
}

for (const msg of CREATE) {
  test(`CREATE: ${msg}`, async () => {
    assert.equal(await classifyAppointmentAction(msg), "CREATE");
  });
}
