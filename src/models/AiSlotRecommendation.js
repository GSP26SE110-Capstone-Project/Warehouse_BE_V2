import defineModel from './defineModel.js';

export const aiSlotRecommendationSchema = {
  recommendationId: {
    type: 'string',
    primaryKey: true,
  },
  inboundRequestId: {
    type: 'string',
    required: false,
    foreignKey: 'inbound_request_id',
  },
  recommendedBinId: {
    type: 'string',
    required: false,
    foreignKey: 'bin_id',
  },
  recommendationScore: {
    type: 'decimal',
    required: false,
  },
  reason: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'ai_slot_recommendations';

const AiSlotRecommendation = defineModel(tableName, aiSlotRecommendationSchema);

export { AiSlotRecommendation };
export default AiSlotRecommendation;
