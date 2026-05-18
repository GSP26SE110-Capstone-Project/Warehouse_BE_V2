import defineModel from './defineModel.js';

export const seasonSchema = {
  seasonId: {
    type: 'string',
    primaryKey: true,
  },
  seasonName: {
    type: 'string',
    required: true,
  },
};

export const tableName = 'seasons';

const Season = defineModel(tableName, seasonSchema);

export { Season };
export default Season;
