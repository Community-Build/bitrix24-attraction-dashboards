export const REPAIRABLE_REJECTION_STAGE_IDS = new Set(["C10:UC_XEEP0A"]);
export const RETURN_TO_LEADGEN_STAGE_IDS = new Set(["C10:UC_EA3R76"]);

const LOSS_STAGE_NAME_PATTERN = /корзин|возврат|неквал|проиг|отклон|отказ|утер/i;

export type AttractionDealStageRoute = "productive" | "won" | "lost" | "return";

export function resolveAttractionDealStageRoute(input: {
  stageId: string;
  stageName?: string | null;
  stageSemanticId: string | null;
  isWonStage?: boolean;
}): AttractionDealStageRoute {
  if (input.isWonStage || input.stageSemanticId === "S") return "won";
  if (REPAIRABLE_REJECTION_STAGE_IDS.has(input.stageId)) return "productive";
  if (RETURN_TO_LEADGEN_STAGE_IDS.has(input.stageId)) return "return";
  if (
    input.stageSemanticId === "F" ||
    (input.stageName ? LOSS_STAGE_NAME_PATTERN.test(input.stageName) : false)
  ) {
    return "lost";
  }
  return "productive";
}
