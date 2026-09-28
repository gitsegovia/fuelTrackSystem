import { AppModels } from "./models";
import { Sequelize } from "sequelize";
import { UserRole, UserType } from "../utils/types";
import { Loaders } from "../graphql/helpers/dataloaders";

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
  sid?: string; // id de AuthSession; ausente en tokens emitidos antes de ADR-014
}

export interface OfflineSource {
  createdBy: string;
  deviceFingerprint: string;
  queuedAt: string; // ISO string
}

export interface Context {
  user?: AuthenticatedUser;
  models: AppModels;
  sequelize: Sequelize;
  offlineSource?: OfflineSource; // presente solo en mutations sincronizadas desde la cola offline
  offlineMutationId?: string; // header x-offline-mutation-id: activa la idempotencia de mutations
  loaders: Loaders; // DataLoaders por request (T-023); nunca compartir entre requests
}

//Interface to arguments
export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  userType: UserType;
  companyId: string;
  gasStationId?: string | null;
}

export interface UpdateUserInput extends Partial<CreateUserInput> {
  passwordHash?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface GetByIdInput {
  id: string;
}
