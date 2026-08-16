import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { initializeFirestore, type Firestore } from "firebase-admin/firestore";

import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";

/**
 * Inicialização única (lazy) do Firebase Admin SDK — app, Firestore e Auth
 * compartilham a mesma instância do `App`.
 *
 * Não derruba o servidor no boot se as credenciais estiverem ausentes —
 * apenas as rotas que efetivamente precisam do Firebase falham, de forma
 * controlada, no momento do uso. Isso mantém `/health` e `/api/chat`
 * funcionando mesmo sem Firebase configurado.
 */
function isFirebaseConfigured(): boolean {
  return Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey);
}

let cachedApp: App | null = null;

function getOrInitApp(): App {
  if (!isFirebaseConfigured()) {
    throw new AppError(
      "Firebase Admin não configurado no backend. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env.",
      500,
      "FIREBASE_NOT_CONFIGURED"
    );
  }

  if (cachedApp) {
    return cachedApp;
  }

  cachedApp =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
    });

  return cachedApp;
}

let firestoreInstance: Firestore | null = null;

/** Retorna o cliente Firestore do Admin SDK, inicializando-o na primeira chamada. */
export function getAdminFirestore(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  // `preferRest: true` força o cliente a falar com o Firestore via HTTPS/REST
  // em vez de gRPC. O transporte gRPC padrão do SDK costuma travar (timeout)
  // atrás de firewalls, antivírus ou VPNs mais restritivas — REST evita isso.
  firestoreInstance = initializeFirestore(getOrInitApp(), { preferRest: true });
  return firestoreInstance;
}

let authInstance: Auth | null = null;

/** Retorna o cliente Auth do Admin SDK, usado para verificar ID tokens enviados pelo app mobile. */
export function getAdminAuth(): Auth {
  if (authInstance) {
    return authInstance;
  }

  authInstance = getAuth(getOrInitApp());
  return authInstance;
}
