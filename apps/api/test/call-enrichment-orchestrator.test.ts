import { describe, expect, it, vi } from "vitest";

import { CallAnalysisServiceError } from "../src/server/call-analysis-service";
import {
  createCallEnrichmentOrchestrator,
  type CallEnrichmentAnalysisService,
  type CallEnrichmentOrchestratorRepository,
  type CallEnrichmentPipeline
} from "../src/server/call-enrichment-orchestrator";
import type { CallEnrichmentProposalDraft } from "../src/server/call-enrichment-diff";
import type { CallAnalysisResultRecord } from "../src/server/sqlite-repository";

const callEvent = {
  callId: "CALL1",
  activityId: "A1",
  dealId: "23841",
  contactId: "901",
  managerId: "7",
  durationSeconds: 318,
  occurredAt: "2026-06-09T09:00:00.000Z"
};

const context = {
  attributes: {
    callId: "CALL1",
    crmActivityId: "A1",
    dealId: "23841",
    contactId: "901",
    managerId: "7"
  }
};

const readyAnalysis = {
  callId: "CALL1",
  runId: "run-1",
  status: "ready",
  transcriptByRoles: [],
  fullTranscriptText: "Менеджер: Добрый день.\nКлиент: Добрый день.",
  aiEvaluation: {
    callClassification: {
      type: "primary_sales",
      confidence: 0.86,
      reason: "Живой диалог."
    }
  },
  rawAiEvaluation: {},
  attributes: context.attributes,
  model: "google/gemini-2.5-flash",
  promptVersion: "calls-v2",
  analyzedAt: "2026-06-09T12:00:30.000Z",
  updatedAt: "2026-06-09T12:00:40.000Z"
} satisfies CallAnalysisResultRecord;

const failedOrNoConversationAnalysis = {
  ...readyAnalysis,
  runId: "run-failed",
  aiEvaluation: {
    callClassification: {
      type: "failed_or_no_conversation",
      confidence: 0.94,
      reason: "Автоответчик сообщил, что дозвониться не удалось."
    }
  }
} satisfies CallAnalysisResultRecord;

const proposalDraft = {
  entityType: "contact",
  entityId: "901",
  fieldCode: "UF_CRM_1647946359",
  fieldTitle: "Оборот бизнеса",
  actionType: "fill_empty",
  currentValue: null,
  proposedValue: "602",
  normalizedValue: "602",
  confidence: 0.86,
  evidenceSnippet: "оборот 500-1000 млн"
} satisfies CallEnrichmentProposalDraft;

function createRepository(
  overrides: Partial<CallEnrichmentOrchestratorRepository> = {}
): CallEnrichmentOrchestratorRepository {
  return {
    getEnrichmentProposalBatchByCallId: vi.fn().mockResolvedValue(null),
    createEnrichmentProposalBatch: vi.fn().mockResolvedValue(undefined),
    appendEnrichmentProposalEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function createAnalysis(
  overrides: Partial<CallEnrichmentAnalysisService> = {}
): CallEnrichmentAnalysisService {
  return {
    getCallAnalysisContext: vi.fn().mockResolvedValue(context),
    analyzeCall: vi.fn().mockResolvedValue({
      status: "ready",
      reusedExistingResult: false,
      result: readyAnalysis
    }),
    ...overrides
  };
}

function createPipeline(
  proposals: CallEnrichmentProposalDraft[] = [proposalDraft]
): CallEnrichmentPipeline {
  return {
    runAfterCallAnalysis: vi.fn().mockResolvedValue({
      proposals,
      skipped: []
    })
  };
}

describe("createCallEnrichmentOrchestrator", () => {
  it("returns duplicate for an active call and does not run analysis twice", async () => {
    let finishAnalysis!: (value: unknown) => void;
    const analysisPromise = new Promise((resolve) => {
      finishAnalysis = resolve;
    });
    const analysis = createAnalysis({
      analyzeCall: vi.fn().mockReturnValue(analysisPromise)
    });
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository: createRepository(),
      enrichmentPipeline: createPipeline(),
      idGenerator: () => "id",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    const firstResult = orchestrator.queueAutomaticCallAnalysis(callEvent);
    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "duplicate",
      callId: "CALL1",
      reason: "CALL_ALREADY_ACTIVE"
    });

    finishAnalysis({
      status: "ready",
      reusedExistingResult: false,
      result: readyAnalysis
    });
    await expect(firstResult).resolves.toEqual({
      status: "queued",
      callId: "CALL1"
    });
    expect(analysis.analyzeCall).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate calls when a proposal batch already exists", async () => {
    const repository = createRepository({
      getEnrichmentProposalBatchByCallId: vi.fn().mockResolvedValue({
        id: "batch-1",
        callId: "CALL1"
      })
    });
    const analysis = createAnalysis();
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "duplicate",
      callId: "CALL1",
      reason: "PROPOSAL_BATCH_EXISTS"
    });
    expect(analysis.analyzeCall).not.toHaveBeenCalled();
  });

  it("records a skipped audit batch when the automatic dialogue gate finds no conversation", async () => {
    const repository = createRepository();
    const analysis = createAnalysis({
      analyzeCall: vi.fn().mockResolvedValue({
        status: "skipped",
        reusedExistingResult: false,
        callId: "CALL1",
        dialogueGate: {
          callId: "CALL1",
          model: "google/gemini-2.5-flash-lite",
          promptVersion: "dialogue-gate-v1",
          analyzedAt: "2026-06-09T12:00:20.000Z",
          gate: {
            hasDialogue: false,
            evidenceType: "operator_no_answer",
            confidence: 0.94,
            reason: "Оператор сказал, что не удалось дозвониться.",
            evidenceSnippet: "Не удалось дозвониться."
          },
          rawGate: {},
          usage: {
            totalTokens: 64
          }
        }
      })
    });
    const pipeline = createPipeline([]);
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository,
      enrichmentPipeline: pipeline,
      idGenerator: vi.fn().mockReturnValueOnce("batch-1").mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "NO_DIALOGUE"
    });
    expect(analysis.analyzeCall).toHaveBeenCalledWith({
      callId: "CALL1",
      triggerMode: "automatic"
    });
    expect(repository.createEnrichmentProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "batch-1",
        callId: "CALL1",
        activityId: "A1",
        dealId: "23841",
        contactId: "901",
        managerId: "7",
        callAnalysisRunId: null,
        status: "failed",
        proposals: []
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        batchId: "batch-1",
        action: "batch.skipped",
        reason: "NO_DIALOGUE"
      })
    );
    expect(pipeline.runAfterCallAnalysis).not.toHaveBeenCalled();
  });

  it("calls full analysis with automatic trigger mode when context can be resolved", async () => {
    const analysis = createAnalysis();
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository: createRepository(),
      enrichmentPipeline: createPipeline()
    });

    await orchestrator.queueAutomaticCallAnalysis(callEvent);

    expect(analysis.analyzeCall).toHaveBeenCalledWith({
      callId: "CALL1",
      triggerMode: "automatic"
    });
  });

  it("does not run downstream enrichment for failed_or_no_conversation analysis", async () => {
    const repository = createRepository();
    const analysis = createAnalysis({
      analyzeCall: vi.fn().mockResolvedValue({
        status: "ready",
        reusedExistingResult: false,
        result: failedOrNoConversationAnalysis
      })
    });
    const pipeline = createPipeline([]);
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository,
      enrichmentPipeline: pipeline,
      idGenerator: vi.fn().mockReturnValueOnce("batch-1").mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "FAILED_OR_NO_CONVERSATION"
    });
    expect(repository.createEnrichmentProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        callAnalysisRunId: "run-failed",
        status: "failed",
        proposals: []
      })
    );
    expect(pipeline.runAfterCallAnalysis).not.toHaveBeenCalled();
  });

  it("skips calls without a resolved deal id before full analysis", async () => {
    const analysis = createAnalysis({
      getCallAnalysisContext: vi.fn().mockResolvedValue({
        attributes: {
          ...context.attributes,
          dealId: null
        }
      })
    });
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository: createRepository(),
      enrichmentPipeline: createPipeline()
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "DEAL_NOT_RESOLVED"
    });
    expect(analysis.analyzeCall).not.toHaveBeenCalled();
  });

  it("skips calls without a resolved manager id before full analysis", async () => {
    const analysis = createAnalysis({
      getCallAnalysisContext: vi.fn().mockResolvedValue({
        attributes: {
          ...context.attributes,
          managerId: null
        }
      })
    });
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository: createRepository(),
      enrichmentPipeline: createPipeline()
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "MANAGER_NOT_RESOLVED"
    });
    expect(analysis.analyzeCall).not.toHaveBeenCalled();
  });

  it("skips non-pilot managers before full analysis", async () => {
    const repository = createRepository();
    const analysis = createAnalysis();
    const pipeline = createPipeline();
    const proposalNotifier = {
      sendProposalBatch: vi.fn().mockResolvedValue(undefined)
    };
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository,
      enrichmentPipeline: pipeline,
      proposalNotifier,
      pilotManagerIds: ["other-manager"],
      idGenerator: vi.fn().mockReturnValueOnce("batch-1").mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "MANAGER_NOT_IN_PILOT"
    });
    expect(analysis.analyzeCall).not.toHaveBeenCalled();
    expect(pipeline.runAfterCallAnalysis).not.toHaveBeenCalled();
    expect(proposalNotifier.sendProposalBatch).not.toHaveBeenCalled();
    expect(repository.createEnrichmentProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "batch-1",
        callId: "CALL1",
        managerId: "7",
        status: "failed",
        proposals: []
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        batchId: "batch-1",
        action: "batch.skipped",
        reason: "MANAGER_NOT_IN_PILOT"
      })
    );
  });

  it("creates a pending proposal batch after successful enrichment diff", async () => {
    const pipeline = createPipeline();
    const repository = createRepository();
    const analysis = createAnalysis();
    const proposalNotifier = {
      sendProposalBatch: vi.fn().mockResolvedValue(undefined)
    };
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository,
      enrichmentPipeline: pipeline,
      proposalNotifier,
      idGenerator: vi
        .fn()
        .mockReturnValueOnce("batch-1")
        .mockReturnValueOnce("proposal-1")
        .mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "queued",
      callId: "CALL1"
    });
    expect(pipeline.runAfterCallAnalysis).toHaveBeenCalledTimes(1);
    expect(pipeline.runAfterCallAnalysis).toHaveBeenCalledWith({
      callEvent,
      context,
      analysis: readyAnalysis
    });
    expect(repository.createEnrichmentProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "batch-1",
        callId: "CALL1",
        activityId: "A1",
        dealId: "23841",
        contactId: "901",
        managerId: "7",
        callAnalysisRunId: "run-1",
        status: "pending",
        proposals: [
          {
            ...proposalDraft,
            id: "proposal-1",
            status: "pending",
            createdAt: "2026-06-09T12:00:00.000Z",
            updatedAt: "2026-06-09T12:00:00.000Z"
          }
        ]
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        batchId: "batch-1",
        action: "batch.created",
        afterStatus: "pending",
        metadata: {
          proposalCount: 1,
          skippedCandidates: []
        }
      })
    );
    expect(proposalNotifier.sendProposalBatch).toHaveBeenCalledWith({
      batch: {
        id: "batch-1",
        callId: "CALL1",
        dealId: "23841",
        contactId: "901",
        managerId: "7",
        expiresAt: "2026-06-11T12:00:00.000Z"
      },
      proposals: [
        {
          ...proposalDraft,
          id: "proposal-1",
          status: "pending",
          createdAt: "2026-06-09T12:00:00.000Z",
          updatedAt: "2026-06-09T12:00:00.000Z"
        }
      ]
    });
  });

  it("records a skipped batch when enrichment has no material updates", async () => {
    const repository = createRepository();
    const pipeline = createPipeline([]);
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis: createAnalysis(),
      repository,
      enrichmentPipeline: pipeline,
      idGenerator: vi.fn().mockReturnValueOnce("batch-1").mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "NO_MATERIAL_UPDATES"
    });
    expect(repository.createEnrichmentProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "batch-1",
        callAnalysisRunId: "run-1",
        status: "failed",
        proposals: []
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        batchId: "batch-1",
        action: "batch.skipped",
        reason: "NO_MATERIAL_UPDATES"
      })
    );
  });

  it("sends an informational follow-up note when enrichment has no CRM proposals", async () => {
    const repository = createRepository();
    const followUpNote = {
      classificationType: "scheduling",
      summary: "Клиент согласовал созвон на завтра в обед.",
      nextStep: "Перезвонить завтра в обед и отправить Zoom."
    };
    const pipeline = {
      runAfterCallAnalysis: vi.fn().mockResolvedValue({
        proposals: [],
        skipped: [],
        followUpNote
      })
    } satisfies CallEnrichmentPipeline;
    const proposalNotifier = {
      sendProposalBatch: vi.fn().mockResolvedValue(undefined),
      sendFollowUpNote: vi.fn().mockResolvedValue(undefined)
    };
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis: createAnalysis(),
      repository,
      enrichmentPipeline: pipeline,
      proposalNotifier,
      idGenerator: vi.fn().mockReturnValueOnce("batch-1").mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "NO_MATERIAL_UPDATES"
    });
    expect(repository.createEnrichmentProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "batch-1",
        status: "failed",
        proposals: []
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        batchId: "batch-1",
        action: "batch.skipped",
        reason: "NO_MATERIAL_UPDATES",
        metadata: expect.objectContaining({
          followUpNote
        })
      })
    );
    expect(proposalNotifier.sendProposalBatch).not.toHaveBeenCalled();
    expect(proposalNotifier.sendFollowUpNote).toHaveBeenCalledWith({
      batch: {
        id: "batch-1",
        callId: "CALL1",
        dealId: "23841",
        contactId: "901",
        managerId: "7",
        expiresAt: "2026-06-11T12:00:00.000Z"
      },
      note: followUpNote
    });
  });

  it("converts service active-run errors to duplicate queue responses", async () => {
    const analysis = createAnalysis({
      analyzeCall: vi.fn().mockRejectedValue(
        new CallAnalysisServiceError(
          "CALL_ANALYSIS_ALREADY_RUNNING",
          "Call analysis is already running for this call.",
          409
        )
      )
    });
    const orchestrator = createCallEnrichmentOrchestrator({
      analysis,
      repository: createRepository(),
      enrichmentPipeline: createPipeline()
    });

    await expect(orchestrator.queueAutomaticCallAnalysis(callEvent)).resolves.toEqual({
      status: "duplicate",
      callId: "CALL1",
      reason: "CALL_ANALYSIS_ALREADY_RUNNING"
    });
  });
});
