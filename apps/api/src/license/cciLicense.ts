import { createPublicKey, verify } from "node:crypto";

// Contrato de CCI Licencias (cci-licensing/README.md, "Verificar la licencia en FuelTrack").
// Verificación sin red: Ed25519 sobre el texto ASCII "CCI1.<payload>" tal cual, nunca sobre el
// JSON re-serializado.
export interface CciLicensePayload {
  v: 1;
  kid: string;
  customerId: string;
  customerName: string;
  instanceId: string;
  product: string;
  plan: string;
  maxStations: number;
  modality: "SAAS" | "ON_PREMISE";
  fingerprint: string;
  issuedAt: string;
  expiresAt: string;
  graceDays: number;
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
    if (payload?.v !== 1 || typeof payload.expiresAt !== "string" || typeof payload.fingerprint !== "string") {
      return null;
    }
    return payload as CciLicensePayload;
  } catch {
    return null; // firma mal formada, payload no es JSON, clave pública inválida, etc.
  }
}
