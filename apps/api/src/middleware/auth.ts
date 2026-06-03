import jwt from "jsonwebtoken";
import config from "../config";
import { AuthenticatedUser } from "../interfaces";

export function verifyToken(token: string): AuthenticatedUser | undefined {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    return decoded;
  } catch {
    return undefined;
  }
}
