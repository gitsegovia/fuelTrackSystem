import { AppModels } from "./models";
import { Sequelize } from "sequelize";
import { UserRole, UserType } from "../utils/types";

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface Context {
  user?: AuthenticatedUser;
  models: AppModels;
  sequelize: Sequelize;
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
