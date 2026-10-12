import { createPublicKey, verify } from "node:crypto";

// Contrato de CCI Licencias (cci-licensing/README.md, "Verificar la licencia en FuelTrack").
// Verificación sin red: Ed25519 sobre el texto ASCII "CCI1.<payload>" tal cual, nunca sobre el
// JSON re-serializado.
export interface CciLicensePayload {
  v: 2;
  kid: string;
  customerId: string;
  customerName: string;
  instanceId: string;
  product: string;
  plan: string;
  modality: "SAAS" | "ON_PREMISE";
  fingerprint: string;
  issuedAt: string;
  expiresAt: string;
  graceDays: number;
  trial: boolean;
  // Mapas genéricos por clave (ADR-009 de cci-licensing): FuelTrack solo usa la clave "stations".
  limits: Record<string, number>;
  // Solo aparece para las claves cuyos IDs informa el producto (ADR-012). Si falta la clave
  // "stations", todavía no se informó nunca: no se bloquea por autorización (T-058).
  authorized?: Record<string, string[]>;
}

export function verifyCciLicense(token: string, publicKeyPem: string): CciLicensePayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [prefix, body, sig] = parts;
  if (prefix !== "CCI1" || !body || !sig) return null;

  try {
    const ok = verify(
      null,
      Buffer.from(`${prefix}.${body}`, "ascii"),
      createPublicKey(publicKeyPem),
      Buffer.from(sig, "base64url")
    );
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    // Corte limpio v1 -> v2 (T-058): una licencia "v: 1" ya no se acepta, aunque la firma sea válida.
    if (payload?.v !== 2 || typeof payload.expiresAt !== "string" || typeof payload.fingerprint !== "string") {
      return null;
    }
    return payload as CciLicensePayload;
  } catch {
    return null; // firma mal formada, payload no es JSON, clave pública inválida, etc.
  }
}
