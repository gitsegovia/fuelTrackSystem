import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { getSnapshot } from "../../license/service";

const licenseResolver: IResolvers<Context> = {
  Query: {
    licenseStatus: async (_parent, _args, context: Context) => getSnapshot(context.models),
  },
};

export default licenseResolver;
