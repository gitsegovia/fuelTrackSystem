import { IResolvers } from "@graphql-tools/utils";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../../config";
import {
  Context,
  AuthenticatedUser,
  CreateUserInput,
  UpdateUserInput,
  LoginInput,
} from "../../interfaces";
import { ArgsType, ParentType, UserRole } from "../../utils/types";
import { hasRole, isAuthenticated } from "../../middleware/authorization";
import { User as UserModel } from "src/models/user";

const userResolver: IResolvers<Context> = {
  Query: {
    me: async (_parent: ParentType, _args: ArgsType, context: Context) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }

      const user = await context.models.User.findByPk(context.user.id);
      if (!user) {
        throw new Error("User not found."); // O un error más específico si el usuario del token no existe
      }
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        userType: user.userType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    },
    users: async (_parent, _args, context: Context) => {
      // Incluir relaciones para evitar N+1 si se piden a menudo
      return context.models.User.findAll({
        include: [
          { model: context.models.Company, as: "company" },
          { model: context.models.GasStation, as: "assignedGasStation" },
          { model: context.models.Employee, as: "employeeProfile" },
        ],
      });
    },
    user: async (
      _parent: ParentType,
      { id }: { id: string },
      context: Context
    ) => {
      hasRole(context.user, UserRole.ADMIN);

      const user = await context.models.User.findByPk(id, {
        include: [
          { model: context.models.Company, as: "company" },
          { model: context.models.GasStation, as: "assignedGasStation" },
          { model: context.models.Employee, as: "employeeProfile" },
        ],
      });
      if (!user) {
        throw new Error("User not found.");
      }

      return user;
    },
  },
  Mutation: {
    createUser: async (
      _parent: ParentType,
      { input }: { input: CreateUserInput },
      context: Context
    ) => {
      const { username, password, role, userType, companyId, gasStationId } =
        input;
      if (!username || !password) {
        throw new Error("Username and password are required.");
      }

      if (role && (role === UserRole.ADMIN || role === UserRole.MANAGER)) {
        const totalUsers = await context.models.User.count();
        if (totalUsers > 0) {
          isAuthenticated(context.user);
          hasRole(context.user, UserRole.ADMIN);
        }
      }

      const existingUser = await context.models.User.findOne({
        where: { username },
      });
      if (existingUser) {
        throw new Error(
          "Username already exists. Please choose a different one."
        );
      }
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const passwordHash = await bcrypt.hash(password, 10);
          const newUser = await context.models.User.create(
            {
              username,
              passwordHash,
              role: role,
              userType: userType,
              companyId: companyId,
              gasStationId: gasStationId,
            },
            { transaction: t }
          );

          return newUser;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error en la mutación 'createUser':`,
          error.message || error
        );
        // Manejo específico para errores de unicidad
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Username already exists. Please choose another one."
          );
        }
        throw new Error(
          `An error occurred while creating the user: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    updateUser: async (
      _parent: ParentType,
      { id, input }: { id: string; input: UpdateUserInput },
      context: Context
    ) => {
      //TODO ajustar que los usuarios de rol alto solo puedan ser modificados por usuarios de rol alto
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const user = await context.models.User.findByPk(id, {
            transaction: t,
          });
          if (!user) {
            throw new Error("User not found.");
          }

          // Si se proporciona una nueva contraseña, hashearla
          let passwordHash = undefined;
          if (input.password) {
            passwordHash = await bcrypt.hash(input.password, 10);
            delete input.password;
          }

          const updateUser = input;
          if (passwordHash) updateUser.passwordHash = passwordHash;

          await user.update(updateUser, { transaction: t });
          return user;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error en la mutación 'updateUser':`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Username already exists. Please choose another one."
          );
        }
        throw new Error(
          `An error occurred while creating the user: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    deleteUser: async (
      _parent: ParentType,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.User.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error en la mutación 'deleteUser':`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the user: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    login: async (
      _parent: ParentType,
      { input }: { input: LoginInput },
      context
    ) => {
      const { username, password } = input;
      if (!username || !password) {
        throw new Error("Username and password are required.");
      }

      const user = await context.models.User.findOne({ where: { username } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new Error("Invalid username or password.");
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        config.jwtSecret,
        { expiresIn: "1h" }
      );

      return { token, user };
    },
  },
  User: {
    company: async (parent: UserModel, _args, _context: Context) => {
      return parent.getCompany();
    },
    assignedGasStation: async (parent: UserModel, _args, _context: Context) => {
      return parent.getAssignedGasStation();
    },
    employeeProfile: async (parent: UserModel, _args, _context: Context) => {
      return parent.getEmployeeProfile();
    },
  },
};

export default userResolver;
