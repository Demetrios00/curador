# CuraDor Mobile — atualização do front-end (Fase 2: migração da IA)

Este pacote contém **apenas os arquivos alterados/novos** do app mobile,
necessários para o Agente IA parar de chamar a OpenRouter diretamente e
passar a usar o backend já entregue (`curador-backend-fase1-passo1.zip` +
`curador-backend-update-llm.zip`).

## O que mudou

| Arquivo | Ação | Onde colocar no seu projeto |
|---|---|---|
| `src/services/api.ts` | **Novo** | Ajuste o caminho se seu projeto não usa `src/services/` — é o único lugar novo que fala com o backend. |
| `src/screens/AgenteIA.tsx` | **Substituir** | Coloque no mesmo caminho onde está seu `AgenteIA.tsx` atual (não sei o caminho exato do seu repositório — ajuste conforme necessário). Só a função `fetchAIResponse` e os imports do topo mudaram; todo o resto (UI, estilos, estado) é idêntico ao original. |
| `src/config/openrouter.ts` | **Excluir do projeto** | Este arquivo aqui é só um "aviso" — delete o `config/openrouter.ts` real do seu app. Nenhum outro arquivo deveria importar dele além do antigo `AgenteIA.tsx`. |
| `.env.example` | **Novo** | Copie para `.env` na raiz do app mobile e ajuste `EXPO_PUBLIC_API_BASE_URL`. |

## Ação de segurança obrigatória

A chave que estava em `openrouter.ts` (`sk-or-v1-c35aa8b419c...`) deve ser
revogada em https://openrouter.ai/keys — ela ficou exposta no bundle do
app e deve ser tratada como comprometida, independentemente desta migração.

## Pré-requisito no backend

O endpoint `POST /api/chat` foi adicionado ao backend (pacote
`curador-backend-update-llm.zip`, entregue junto). Aplique-o antes de testar
este front-end — sem ele, o app vai receber erro de rede ao enviar mensagens.

## Como testar (nível: integração app + backend)

1. No backend: `cp .env.example .env`, preencha `LLM_API_KEY` com uma chave
   **nova** da OpenRouter, rode `npm install && npm run dev`.
2. No mobile: copie `.env.example` para `.env`, ajuste `EXPO_PUBLIC_API_BASE_URL`
   conforme o ambiente de teste (simulador/emulador/dispositivo — ver
   comentários no arquivo).
3. Rode o app (`npx expo start`) e abra a tela "Agente IA".
4. Envie uma mensagem.

**Resultado esperado:** a resposta do assistente aparece normalmente na
tela, exatamente como antes — a diferença é que a chamada de rede agora
vai para o seu backend (`/api/chat`), não mais direto para a OpenRouter.
Se quiser confirmar isso, veja no terminal do backend o log da requisição
recebida.
