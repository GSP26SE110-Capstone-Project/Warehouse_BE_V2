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
  lpnId: {
    type: 'string',
    required: false,
    foreignKey: 'lpn_id',
  },
  skuId: {
    type: 'string',
    required: false,
    foreignKey: 'sku_id',
  },
  recommendedZoneId: {
    type: 'string',
    required: false,
    foreignKey: 'zone_id',
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
  isApplied: {
    type: 'boolean',
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
