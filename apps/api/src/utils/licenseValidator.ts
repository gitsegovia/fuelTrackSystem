import axios from "axios";
import crypto from "crypto";
import fs from "fs/promises";

const FINGERPRINT_PATH =
  process.env.FINGERPRINT_PATH || "/etc/fueltrack/fingerprint";

/**
 * Valida la licencia de la aplicación contra un servidor de licencias central.
 * @returns {Promise<boolean>} `true` si la licencia es válida, `false` en caso contrario.
 */
export async function validateLicense(): Promise<boolean> {
  console.log("Iniciando validación de licencia...");

  const licenseKey = process.env.LICENSE_KEY;
  const licenseServerUrl = process.env.LICENSE_SERVER_URL;

  if (!licenseKey || !licenseServerUrl) {
    console.error(
      "Error: Las variables de entorno LICENSE_KEY y LICENSE_SERVER_URL son obligatorias."
    );
    return false;
  }

  try {
    // 1. Leer el hash del fingerprint generado localmente por el entrypoint.sh
    const localFingerprintHash = (
      await fs.readFile(FINGERPRINT_PATH, "utf8")
    ).trim();

    // 2. Obtener el hash esperado desde tu servidor de licencias
    console.log("Contactando al servidor de licencias para validación...");
    const response = await axios.post(`${licenseServerUrl}/validate`, {
      licenseKey,
    });

    const expectedFingerprintHash = response.data.fingerprintHash;

    if (!expectedFingerprintHash) {
      console.error(
        "Error de licencia: El servidor de licencias no devolvió un hash válido."
      );
      return false;
    }

    // 3. Comparar ambos hashes de forma segura para prevenir ataques de temporización
    const localBuffer = Buffer.from(localFingerprintHash, "hex");
    const expectedBuffer = Buffer.from(expectedFingerprintHash, "hex");

    if (localBuffer.length !== expectedBuffer.length) {
      console.error("Error de licencia: Discrepancia en la longitud del hash.");
      return false;
    }

    const isValid = crypto.timingSafeEqual(localBuffer, expectedBuffer);

    if (isValid) {
      console.log("Licencia validada exitosamente.");
      return true;
    } else {
      console.error(
        "Error de licencia: La licencia no es válida para esta máquina. Fingerprint no coincide."
      );
      return false;
    }
  } catch (error: any) {
    console.error(
      "No se pudo validar la licencia. Verifique la conexión con el servidor de licencias o la configuración."
    );
    console.error(error.message);
    return false;
  }
}
