import { z } from "zod";

import { listResultsByPatient } from "../../repositories/results.repository";

export const GET_EXAM_RESULTS_TOOL_NAME = "get_exam_results";

export const getExamResultsInputSchema = {
  patientUid: z.string().min(1).describe("UID do paciente autenticado no Firebase, dono dos resultados."),
};

export async function getExamResultsHandler({ patientUid }: { patientUid: string }) {
  const results = await listResultsByPatient(patientUid);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(results) }],
  };
}
