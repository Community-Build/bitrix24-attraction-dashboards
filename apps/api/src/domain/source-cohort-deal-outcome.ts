import type { SourceCohortDealOutcome } from "@bitrix24-reporting/contracts";

import {
  REPAIRABLE_REJECTION_STAGE_IDS,
  RETURN_TO_LEADGEN_STAGE_IDS,
  resolveAttractionDealStageRoute
} from "./attraction-deal-outcome.js";

export { REPAIRABLE_REJECTION_STAGE_IDS, RETURN_TO_LEADGEN_STAGE_IDS };

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
  return resolveAttractionDealStageRoute(input);
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
