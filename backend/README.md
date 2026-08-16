# CuraDor — Backend

Backend intermediário (Node.js + TypeScript) do CuraDor. Responsável por
intermediar a comunicação entre o app mobile, os agentes especializados e a
camada MCP — nunca expor segredos de API ao cliente mobile.

## Status atual

- [x] **Fase 1 — Backend mínimo** (health check, variáveis de ambiente, tratamento de erros, LLM, Firebase Admin — validado com credenciais reais)
- [x] **Fase 2 — Migração da IA** (validado — `/api/chat` respondendo com chave real da OpenRouter)
- [x] **Fase 3 — Orquestrador simples** (validado — `/api/orchestrator/route` classificando intenção corretamente)
- [x] **Fase 4 — Agente de Agendamentos** (autenticação via Firebase ID token + consulta real ao Firestore)
- [x] **Fase 5 — MCP** (validada de ponta a ponta, com Firestore real — vazio e populado)
- [x] **Fase 6 (parcial) — Agente de Instruções** (validado de ponta a ponta, com Firestore real)
- [x] **Fase 6 (parcial) — Agente de Resultados** (validado de ponta a ponta, com Firestore real)
- [x] **Fase 6 — Agente de Unidades** (validado de ponta a ponta, com Firestore real — os quatro agentes previstos no artigo estão implementados)
- [x] **Fase 7 — Rastreabilidade (`agent_logs`)** (validado neste ambiente: gravação segura/fire-and-forget confirmada sem Firebase configurado; endpoint de resumo/avaliação testado com dados simulados; falta a validação com Firestore real, feita por você a seguir)
- [x] **Fase 5a — Agente de Agendamentos: consulta ampliada (passado + status)** (typecheck/build validados neste ambiente + lógica pura testada isoladamente; falta a validação end-to-end com Firestore real, feita por você a seguir)

## Endpoint POST /api/orchestrator/route (autenticado)

Requer header `Authorization: Bearer <ID token do Firebase>` — o mesmo token que o app mobile obtém via `user.getIdToken()` no `AuthContext`. Sem token válido: `401 UNAUTHENTICATED`.

Classifica a intenção da mensagem (`APPOINTMENTS`, `INSTRUCTIONS`, `RESULTS`, `UNITS`, `UNKNOWN`). Quando a intenção é `APPOINTMENTS`, aciona o **Agente de Agendamentos**. Quando é `INSTRUCTIONS`, aciona o **Agente de Instruções**. Quando é `RESULTS`, aciona o **Agente de Resultados**. Quando é `UNITS`, aciona o **Agente de Unidades** (ver seção própria abaixo — único que também depende de `location` no corpo). Nunca a partir de um `patientUid` enviado no corpo — isso seria uma falha de segurança.

Com isso, os quatro agentes especializados previstos no artigo estão implementados.

```bash
curl -X POST http://localhost:3333/api/orchestrator/route \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ID_TOKEN" \
  -d '{"message":"Quais consultas tenho essa semana?"}'
```

Resposta esperada (200) para intenção `APPOINTMENTS`:
```json
{
  "requestId": "...",
  "intent": "APPOINTMENTS",
  "confidence": 0.9,
  "agent": "appointments",
  "result": {
    "message": "Você tem 4 agendamentos no total (1 marcado(s), 1 realizado(s), 1 cancelado(s) e 1 perdido(s)). O próximo é Consulta Cardiologia em 26 de jun. de 2026 às 09:11 (Hospital Prime Care).",
    "upcoming": [{ "id": "...", "title": "...", "date": "...", "status": "agendado", "displayStatus": "Marcado", "hospitalName": "...", "doctorName": null }],
    "history": [{ "id": "...", "title": "...", "date": "...", "status": "concluido", "displayStatus": "Realizado", "hospitalName": "...", "doctorName": null }],
    "summary": { "total": 4, "marcados": 1, "realizados": 1, "cancelados": 1, "perdidos": 1 }
  }
}
```

**Fase 5a (evolução pós-Fase 7):** o Agente de Agendamentos deixou de considerar só o futuro — agora retorna também o histórico (`history`) e contagens por status (`summary`), incluindo `"Perdido"`, um status **calculado** (não persistido no Firestore) para agendamentos com `status` `"agendado"`/`"confirmado"` cuja data já passou. Decisão registrada em `claude/avaliacao-evolucao-pre-fase8.md` — evita migração de dado e não exige nenhum job em segundo plano. Nenhuma mudança de schema, ferramenta MCP ou repositório foi necessária: a consulta ao Firestore já retornava todos os agendamentos, o filtro era aplicado no próprio agente.

Cada chamada também gera uma linha de log estruturado no terminal do backend (`requestId`, `userId`, `intent`, `confidence`, `selectedAgent`, `toolUsed`, `latencyMs`, `success`) — a base da rastreabilidade que vira a coleção `agent_logs` na Fase 7.

### Como conseguir um ID token para testar (sem mexer no app mobile)

```powershell
$signIn = Invoke-RestMethod -Method Post `
  -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=SUA_FIREBASE_API_KEY_PUBLICA" `
  -ContentType "application/json" `
  -Body '{"email":"EMAIL_DE_UM_PACIENTE_DE_TESTE","password":"SENHA","returnSecureToken":true}'
$idToken = $signIn.idToken
```
(`SUA_FIREBASE_API_KEY_PUBLICA` é o `apiKey` do `firebaseConfig` do app — não é segredo, é o mesmo usado pelo cliente.)

## Model Context Protocol (Fase 5)

Nesta fase, o **Agente de Agendamentos** deixou de acessar o Firestore
diretamente e passou a obter os dados através de uma ferramenta MCP.

**Papéis MCP nesta implementação:**
- **Host + Client MCP**: o próprio backend Node.js (`mcp/clients/appointmentsMcpClient.ts`, renomeado de `mcpClientManager.ts` na Fase 6 ao surgir um segundo domínio) — mantém uma conexão de sessão única e reaproveitada com o servidor. A lógica de conexão (comum a todo domínio) foi extraída para `mcp/clients/mcpConnectionFactory.ts`.
- **Server MCP**: um processo Node separado (`mcp/servers/appointmentsMcpServer.ts`), iniciado como subprocesso pelo backend e comunicando-se por stdio (entrada/saída padrão), conforme a especificação do protocolo.
- **Tool exposta**: `list_user_appointments(patientUid)` — única ferramenta desta fase, deliberadamente (Seção 5 do projeto: "não criar dezenas de ferramentas").

**Por que MCP aqui e não uma chamada direta?** O Agente de Agendamentos não
precisa (nem deve) saber que o dado vem do Firestore — ele só sabe que existe
uma ferramenta padronizada chamada `list_user_appointments`. Isso permite, no
futuro, trocar a fonte de dados (outro banco, um sistema de terceiros) sem
alterar o agente, e permite que outros hosts MCP (não só este backend)
reaproveitem o mesmo servidor de ferramentas — é a interoperabilidade citada
na Seção 15 do projeto.

**Nota técnica sobre um problema resolvido nesta fase:** ao registrar a
ferramenta (`server.registerTool(...)`), o TypeScript falhava com
`TS2589 (Type instantiation is excessively deep and possibly infinite)`.
Isolei o problema em um arquivo mínimo fora deste projeto e confirmei que é
uma limitação conhecida da combinação `@modelcontextprotocol/sdk` (>=1.22) +
TypeScript 5.9 — o tipo genérico de `registerTool` combina o "raw shape" do
Zod com os tipos internos recursivos do próprio Zod, e o compilador
ultrapassa seu limite interno de profundidade ao checar essa combinação.
Não é uma incompatibilidade de versão do `zod` (testei com uma única versão
do `zod`, deduplicada em toda a árvore de dependências, e o erro persistiu).
A correção aplicada restringe um cast de tipo (`as (...args: unknown[]) => unknown`)
exclusivamente à chamada de `registerTool` — o `inputSchema` continua sendo
validado em tempo de execução pelo próprio SDK, e o handler
(`listUserAppointmentsHandler`) mantém sua assinatura própria, totalmente
tipada. O comentário completo está em `mcp/servers/appointmentsMcpServer.ts`.

## Agente de Instruções + segundo servidor MCP (Fase 6)

**Responsabilidade** (Seção 10.2 do projeto): dado um paciente, descobrir seu
próximo exame/cirurgia agendado e devolver a orientação de preparo
cadastrada — nunca orientação clínica.

**Coleção nova `instructions`** (não existia antes desta fase):
```text
instructions/{id}
├── scope: "exam" | "surgery"
├── examTypeId?: string      // FK → examTypes (quando scope = "exam")
├── surgeryTypeId?: string   // FK → surgeryTypes (quando scope = "surgery")
├── title: string
├── instructionsText: string
└── updatedAt: number
```

**Como o agente descobre qual exame responder:** ele reaproveita a MESMA
ferramenta MCP `list_user_appointments` (Fase 5, servidor de Agendamentos)
para achar o próximo exame/cirurgia do paciente, e casa o `title` desse
agendamento com o `name` de `examTypes`/`surgeryTypes` para então buscar a
instrução (ver `repositories/instructions.repository.ts` para o motivo do
casamento por nome em vez de ID — a coleção `appointments` não guarda
`examTypeId`/`surgeryTypeId`, só o título já calculado).

**Segundo servidor MCP**, deliberadamente separado do de Agendamentos (cada
servidor representa um domínio de dados coeso — um cair não derruba o
outro): `mcp/servers/instructionsMcpServer.ts`, expondo a ferramenta
`get_exam_instructions(procedureTitle, scope)`. Cliente correspondente em
`mcp/clients/instructionsMcpClient.ts`.

**Por que duas chamadas MCP em vez de uma só:** este é o exemplo mais claro,
no código, da diferença entre orquestração e MCP (Seção 8 do projeto) — o
Agente de Instruções (não o protocolo) decide, em código, chamar primeiro
`list_user_appointments` e depois `get_exam_instructions`, combinando os
dois resultados. O MCP padroniza cada chamada individual; quem orquestra a
sequência é o agente.

**Antes de testar, popule a coleção `instructions`** (ela começa vazia):
```bash
npm run seed:instructions
```
Cria um registro de instrução genérico para cada `examType`/`surgeryType`
já cadastrado no seu Firestore (sem inventar nomes de exames — usa os que já
existem no seu banco). É idempotente: rodar de novo não duplica. Edite o
texto de cada instrução pelo Firebase Console quando quiser personalizar.

```bash
curl -X POST http://localhost:3333/api/orchestrator/route \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ID_TOKEN" \
  -d '{"message":"Preciso ficar em jejum para meu exame?"}'
```

Resposta esperada (200) para intenção `INSTRUCTIONS`, com um exame futuro cadastrado:
```json
{
  "requestId": "...",
  "intent": "INSTRUCTIONS",
  "confidence": 0.9,
  "agent": "instructions",
  "result": {
    "message": "Chegue com 15 minutos de antecedência. Traga um documento de identidade com foto e o pedido médico...",
    "procedure": { "title": "Hemograma completo", "date": "..." },
    "instruction": { "id": "...", "scope": "exam", "title": "Preparo para Hemograma completo", "instructionsText": "..." }
  }
}
```

Sem exame/cirurgia futuro agendado: `result.message` explica isso de forma
controlada, sem erro. Com exame agendado mas sem instrução cadastrada (ex.:
antes de rodar o seed): idem, mensagem controlada recomendando confirmar
com a unidade.

## Agente de Resultados + terceiro servidor MCP (Fase 6)

**Responsabilidade** (Seção 10.3 do projeto): informar disponibilidade e
status de resultados de exames — nunca seu conteúdo clínico. Segue
literalmente o exemplo permitido/proibido do projeto:
- permitido: *"O resultado do Hemograma realizado em 14/08 está disponível."*
- proibido: *"Seu hemograma indica anemia."*

Por isso `repositories/results.repository.ts` **nem chega a expor** o campo
`summary` da coleção `results` (existe no Firestore, mas pode conter um
laudo/interpretação clínica) — a barreira fica uma camada abaixo do agente,
para que nenhuma mudança futura vaze isso por acidente.

**Não precisou de coleção nova** — `results` já existia (auditada na Fase
0), com o schema confirmado em `types/index.ts` e `Resultados.tsx` do app
mobile.

**Terceiro servidor MCP**, também separado dos demais:
`mcp/servers/resultsMcpServer.ts`, expondo `get_exam_results(patientUid)`.
Cliente em `mcp/clients/resultsMcpClient.ts`.

```bash
curl -X POST http://localhost:3333/api/orchestrator/route \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ID_TOKEN" \
  -d '{"message":"Meu hemograma já ficou pronto?"}'
```

Resposta esperada (200) para intenção `RESULTS`:
```json
{
  "requestId": "...",
  "intent": "RESULTS",
  "confidence": 0.9,
  "agent": "results",
  "result": {
    "message": "O resultado do \"Hemograma completo\" (realizado em 10 de ago. de 2026) está disponível. Você pode baixar o laudo pelo aplicativo.",
    "mostRecent": { "id": "...", "title": "Hemograma completo", "status": "disponivel", "hasFile": true },
    "pendingCount": 0,
    "availableCount": 1
  }
}
```

Sem nenhum resultado cadastrado: `result.message` explica isso de forma
controlada, sem erro.

## Agente de Unidades + quarto servidor MCP (Fase 6 — última)

**Responsabilidade** (Seção 10.4 do projeto): localizar unidades de saúde
próximas do paciente, reaproveitando a lógica de geolocalização já
existente no mobile.

**Diferença arquitetural real em relação aos três agentes anteriores:**
este é o único que não funciona apenas com `patientUid` — precisa também da
localização ATUAL do paciente (`latitude`/`longitude`), que só existe no
dispositivo (GPS via `expo-location`), nunca é salva no Firestore. Por isso
o corpo da requisição ganhou um campo novo, opcional:

```json
{ "message": "...", "location": { "latitude": -25.7395, "longitude": -53.0553 } }
```

`location` só é exigido quando a intenção classificada é `UNITS`. Se
ausente nesse caso, o agente responde de forma controlada, sem erro:
*"Para encontrar unidades próximas, preciso da sua localização..."*. Se
`location` for enviado mas malformado (tipo errado, fora do range), a
API retorna `400 INVALID_LOCATION`.

**Ferramenta `find_nearby_units`** — a única, entre as quatro do backend,
que **não recebe `patientUid`**: unidades de saúde são dado público de
referência (qualquer paciente pode consultar qualquer unidade), diferente
de agendamentos/resultados, que são privados por paciente.

**Fórmula de distância**: `src/utils/geo.ts` é uma cópia fiel de `geo.ts`
do app mobile (mesma constante `EARTH_RADIUS_KM`, mesma fórmula de
Haversine, mesmo `formatDistance`) — não é lógica de negócio duplicada em
dois lugares divergentes, é o cálculo MOVIDO para o backend, como já
recomendava a auditoria da Fase 0. Validado neste ambiente contra uma
distância real conhecida (Dois Vizinhos-PR → Curitiba-PR ≈ 380 km).

```bash
curl -X POST http://localhost:3333/api/orchestrator/route \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ID_TOKEN" \
  -d '{"message":"Qual unidade fica mais perto de mim?","location":{"latitude":-25.7395,"longitude":-53.0553}}'
```

Resposta esperada (200) para intenção `UNITS`:
```json
{
  "requestId": "...",
  "intent": "UNITS",
  "confidence": 0.9,
  "agent": "units",
  "result": {
    "message": "A unidade mais próxima de você é Hospital Vida Caps (Dois Vizinhos/PR), a 800 m. Também próximas: Hospital Atena Premium (3.5 km), Hospital Santa Dó (42 km).",
    "nearestUnits": [{ "id": "...", "name": "Hospital Vida Caps", "distanceKm": 0.8, "city": "...", "state": "...", "address": "...", "services": [] }]
  }
}
```

Se algum hospital não tiver `lat`/`lng` cadastrados no Firestore, ele é
ignorado no cálculo — e a mensagem avisa quantos foram ignorados, em vez de
descartar isso silenciosamente.

## Endpoint POST /api/chat

Substitui a chamada direta que o app mobile fazia à OpenRouter. Requer `LLM_API_KEY` no `.env`.

```bash
curl -X POST http://localhost:3333/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Olá"}]}'
```

Resposta esperada (200): `{"reply": "..."}`
Sem `LLM_API_KEY` configurada: `500 {"error":{"code":"LLM_NOT_CONFIGURED", ...}}`.

## Rastreabilidade — coleção `agent_logs` (Fase 7)

Cada chamada a `POST /api/orchestrator/route` (sucesso ou falha) agora
também é persistida na coleção `agent_logs`, além do log de console já
existente. Campos exatamente conforme a Seção 14 do projeto:

```text
agent_logs/{id}
├── requestId, userId, userMessage
├── intent, confidence, selectedAgent, toolUsed
├── startedAt, finishedAt, latencyMs
├── success, error
└── createdAt
```

**Decisão registrada sobre `userMessage`:** é gravado porque a Seção 14 o
lista explicitamente ("quando apropriado") e a Seção 15 exige avaliar
"taxa de roteamento correto" — impossível sem comparar a mensagem original
com a intenção classificada. Nenhum outro dado de saúde (resultados,
laudos, prescrições) é gravado em `agent_logs`.

**A gravação é assíncrona e não bloqueia a resposta** (`void
createAgentLog(...)`, não `await`) — por dois motivos: (1) uma falha ou
lentidão ao gravar o log nunca deve atrasar/quebrar a resposta ao
paciente; (2) o próprio tempo de gravação não pode contaminar a métrica de
latência que o log existe para medir. Testado neste ambiente sem
credenciais do Firebase: a falha é registrada no console, sem
`unhandledRejection` e sem afetar a resposta HTTP.

### Endpoint GET /api/_internal/agent-logs/summary

Agrega os registros mais recentes em métricas simples — apoio direto à
Seção 15 do projeto (taxa de sucesso, latência média, distribuição de
intenções e agentes acionados). **Não é um resultado experimental com
metodologia controlada** — é um agregado descritivo dos logs existentes,
útil para observar a arquitetura em funcionamento, não para alegações
científicas (mesma cautela da Seção 15).

```bash
curl "http://localhost:3333/api/_internal/agent-logs/summary?limit=200"
```

Resposta esperada (200):
```json
{
  "sampleSize": 6,
  "successCount": 5,
  "errorCount": 1,
  "successRate": 0.8333,
  "averageLatencyMs": 675,
  "countByIntent": { "APPOINTMENTS": 1, "INSTRUCTIONS": 1, "RESULTS": 1, "UNITS": 1, "UNKNOWN": 1 },
  "countBySelectedAgent": { "appointments": 1, "instructions": 1, "results": 1, "units": 1 }
}
```

## Endpoint GET /api/_internal/firebase-check

Endpoint de diagnóstico (não é API de domínio) para validar a conexão com o
Firebase Admin/Firestore. Requer `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`
e `FIREBASE_PRIVATE_KEY` no `.env` (gerados no Firebase Console > Configurações
do Projeto > Contas de Serviço > Gerar nova chave privada).

```bash
curl http://localhost:3333/api/_internal/firebase-check
```

Resposta esperada (200): `{"status":"ok","collection":"hospitals","count":N,"sample":[...]}`
Sem credenciais: `500 {"error":{"code":"FIREBASE_NOT_CONFIGURED", ...}}`.
Falha de rede/credencial inválida: `504 {"error":{"code":"TIMEOUT", ...}}` após 8s, sem derrubar o servidor.

## Como rodar

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Servidor sobe em `http://localhost:3333`.

## Como testar

```bash
curl http://localhost:3333/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "service": "curador-backend",
  "timestamp": "2026-08-15T12:00:00.000Z",
  "uptimeSeconds": 1.23
}
```

## Estrutura de pastas

```text
src/
├── config/       # variáveis de ambiente e configuração
├── routes/       # definição de rotas Express
├── controllers/  # handlers HTTP
├── services/     # regras de negócio reutilizáveis
├── agents/       # orquestrador (Fase 3) e agentes especializados (Fase 4+)
│   ├── appointments/   # Agente de Agendamentos (Fase 4)
│   ├── instructions/   # Agente de Instruções (Fase 6)
│   ├── results/        # Agente de Resultados (Fase 6)
│   └── units/          # Agente de Unidades (Fase 6)
├── mcp/          # (Fase 5+) clients/servers/tools MCP — um servidor por domínio
│   ├── clients/  # mcpConnectionFactory.ts (compartilhada) + 1 client por domínio
│   ├── servers/  # 1 processo/servidor por domínio
│   └── tools/    # definição de cada ferramenta (schema Zod + handler)
├── repositories/ # acesso a dados (Firestore) isolado dos controllers
├── firebase/     # inicialização do Firebase Admin — Firestore + Auth (lazy, fail-safe)
├── llm/          # serviço de LLM (provider-agnostic)
├── types/        # tipos compartilhados
├── middleware/   # error handler, auth, logging
└── utils/        # utilitários gerais

scripts/
└── seedInstructions.ts   # popula a coleção `instructions` (npm run seed:instructions)
```
