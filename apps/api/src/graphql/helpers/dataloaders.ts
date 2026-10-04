import DataLoader from "dataloader";
import { ModelStatic, Op } from "sequelize";
import { AppModels } from "../../interfaces/models";
import { Context } from "../../interfaces";

// T-023 (H-021, riesgo #6): reemplaza los field resolvers `parent.getX()`, que vuelven a
// consultar por fila sin importar si la query padre ya trajo la relación con `include`.
//
// - Si `parent[as]` ya viene definido (la query padre lo incluyó), se devuelve tal cual, sin
//   consultar. Sequelize deja `undefined` cuando no se incluyó, y `null`/`[]` cuando sí se
//   incluyó pero no hay fila relacionada — por eso el chequeo es `!== undefined`, no `if (parent[as])`.
// - Si no, se usa un DataLoader creado por request (`createLoaders`, llamado una vez por
//   `context` en app.ts) que agrupa todas las cargas de la misma tanda de resolvers en una sola
//   consulta `WHERE id IN (...)` o `WHERE fk IN (...)`.

export interface Loaders {
  byId(modelName: keyof AppModels): DataLoader<string, any>;
  byForeignKey(modelName: keyof AppModels, foreignKey: string): DataLoader<string, any[]>;
}

export function createLoaders(models: AppModels): Loaders {
  const idLoaders = new Map<string, DataLoader<string, any>>();
  const fkLoaders = new Map<string, DataLoader<string, any[]>>();

  return {
    byId(modelName) {
      let loader = idLoaders.get(modelName);
      if (!loader) {
        const model = models[modelName] as ModelStatic<any>;
        loader = new DataLoader<string, any>(async (ids) => {
          const rows = await model.findAll({ where: { id: { [Op.in]: ids as string[] } } });
          const byId = new Map(rows.map((r: any) => [r.id, r]));
          return ids.map((id) => byId.get(id) ?? null);
        });
        idLoaders.set(modelName, loader);
      }
      return loader;
    },
    byForeignKey(modelName, foreignKey) {
      const key = `${modelName}:${foreignKey}`;
      let loader = fkLoaders.get(key);
      if (!loader) {
        const model = models[modelName] as ModelStatic<any>;
        loader = new DataLoader<string, any[]>(async (keys) => {
          const rows = await model.findAll({ where: { [foreignKey]: { [Op.in]: keys as string[] } } });
          const byKey = new Map<string, any[]>(keys.map((k) => [k, []]));
          for (const row of rows) {
            byKey.get((row as any)[foreignKey])?.push(row);
          }
          return keys.map((k) => byKey.get(k) ?? []);
        });
        fkLoaders.set(key, loader);
      }
      return loader;
    },
  };
}

// belongsTo/hasOne por FK en el padre (ej. SalesTicket.gasStation vía gasStationId).
export function belongsTo(as: string, modelName: keyof AppModels, foreignKey: string) {
  return async (parent: any, _args: unknown, context: Context) => {
    if (parent[as] !== undefined) return parent[as];
    const fk = parent[foreignKey];
    if (fk == null) return null;
    return context.loaders.byId(modelName).load(fk);
  };
}

// hasMany del padre (ej. Tank.measurements vía tankId en TankMeasurement).
export function hasMany(as: string, modelName: keyof AppModels, foreignKey: string, parentKey = "id") {
  return async (parent: any, _args: unknown, context: Context) => {
    if (parent[as] !== undefined) return parent[as];
    return context.loaders.byForeignKey(modelName, foreignKey).load(parent[parentKey]);
  };
}

// hasOne del padre, cuando la FK vive en el modelo relacionado (ej. Employee.user vía userId en
// Employee — no aplica aquí, pero se deja disponible para el patrón inverso a belongsTo).
export function hasOne(as: string, modelName: keyof AppModels, foreignKey: string, parentKey = "id") {
  return async (parent: any, _args: unknown, context: Context) => {
    if (parent[as] !== undefined) return parent[as];
    const rows = await context.loaders.byForeignKey(modelName, foreignKey).load(parent[parentKey]);
    return rows[0] ?? null;
  };
}
