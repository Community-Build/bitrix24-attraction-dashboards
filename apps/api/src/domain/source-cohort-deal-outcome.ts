import type { SourceCohortDealOutcome } from "@bitrix24-reporting/contracts";

export const REPAIRABLE_REJECTION_STAGE_IDS = new Set(["C10:UC_XEEP0A"]);
export const RETURN_TO_LEADGEN_STAGE_IDS = new Set(["C10:UC_EA3R76"]);

const LOSS_STAGE_NAME_PATTERN = /корзин|возврат|неквал|проиг|отклон|отказ|утер/i;

export type SourceCohortStageRouteKind =
  | "productive"
  | "won"
  | "lost"
  | "return";

export function resolveSourceCohortStageRoute(input: {
  stageId: string;
  stageName: string;
  stageSemanticId: string | null;
  isWonStage?: boolean;
}): SourceCohortStageRouteKind {
  if (input.isWonStage) {
    return "won";
  }

  if (REPAIRABLE_REJECTION_STAGE_IDS.has(input.stageId)) {
    return "productive";
  }

  if (RETURN_TO_LEADGEN_STAGE_IDS.has(input.stageId)) {
    return "return";
  }

  if (input.stageSemanticId === "S") {
    return "won";
  }

  return input.stageSemanticId === "F" ||
    LOSS_STAGE_NAME_PATTERN.test(input.stageName)
    ? "lost"
    : "productive";
}

export function resolveSourceCohortDealOutcome(input: {
  wonAt: string | null;
  stageId: string;
  stageName: string;
  stageSemanticId: string | null;
  isWonStage?: boolean;
}): SourceCohortDealOutcome {
  if (input.wonAt) {
    return "won";
  }

  const route = resolveSourceCohortStageRoute(input);
  if (route === "won") {
    return "won";
  }
  if (route === "return") {
    return "returned";
  }
  if (route === "lost") {
    return "lost";
  }

  return "open";
}
