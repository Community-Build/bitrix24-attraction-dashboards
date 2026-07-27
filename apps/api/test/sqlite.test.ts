import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ATTRACTION_MANAGER_IDS } from "../src/domain/attraction-managers";
import {
  createSqliteRepository,
  type CreateEnrichmentProposalBatchInput,
  type CreateEnrichmentProposalInput
} from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createTempRepository() {
  const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
  tempDirs.push(directory);

  return createSqliteRepository({
    databaseUrl: `file:${join(directory, "reporting.db")}`,
    defaultWonStageIds: ["C1:WON"]
  });
}

function createEnrichmentProposal(
  overrides: Partial<CreateEnrichmentProposalInput> = {}
): CreateEnrichmentProposalInput {
  return {
    id: "proposal-1",
    entityType: "contact",
    entityId: "contact-1",
    fieldCode: "UF_CRM_1647946359",
    fieldTitle: "Оборот бизнеса",
    actionType: "fill_empty",
    currentValue: null,
    proposedValue: "500-1000 млн. рублей",
    normalizedValue: {
      id: "602",
      label: "500-1000 млн. рублей"
    },
    confidence: 0.86,
    evidenceSnippet: "Оборот около 700 млн.",
    status: "pending",
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T10:00:00.000Z",
    ...overrides
  };
}

function createEnrichmentBatch(
  overrides: Partial<CreateEnrichmentProposalBatchInput> = {}
): CreateEnrichmentProposalBatchInput {
  return {
    id: "batch-1",
    callId: "call-1",
    activityId: "activity-1",
    dealId: "deal-1",
    contactId: "contact-1",
    managerId: "manager-1",
    callAnalysisRunId: "run-1",
    status: "pending",
    expiresAt: "2026-06-30T10:00:00.000Z",
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T10:00:00.000Z",
    proposals: [createEnrichmentProposal()],
    ...overrides
  };
}

describe("createSqliteRepository", () => {
  it("persists manager team assignments in whitelist settings", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.replaceManagerWhitelistSettings({
      moduleKey: "attraction",
      managerIds: ["78", "13020", "11234"],
      teams: [
        {
          id: "attraction",
          name: "Привлечение",
          managerIds: ["78", "13020"]
        },
        {
          id: "attraction-stroke",
          name: "Привлечение штрих",
          managerIds: ["11234"]
        }
      ],
      updatedAt: "2026-06-17T10:00:00.000Z"
    });

    await expect(repository.getManagerWhitelistSettings("attraction")).resolves.toEqual([
      expect.objectContaining({
        managerId: "78",
        teamId: "attraction",
        teamName: "Привлечение"
      }),
      expect.objectContaining({
        managerId: "13020",
        teamId: "attraction",
        teamName: "Привлечение"
      }),
      expect.objectContaining({
        managerId: "11234",
        teamId: "attraction-stroke",
        teamName: "Привлечение штрих"
      })
    ]);
  });

  it("persists call analysis runs and the latest transcript result without storing audio", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await expect(repository.getCallAnalysisResult("CALL1")).resolves.toBeNull();

    await repository.startCallAnalysisRun({
      id: "run-1",
      callId: "CALL1",
      crmActivityId: "A1",
      triggerMode: "manual",
      status: "analyzing",
      startedAt: "2026-06-09T12:00:00.000Z",
      recordingSource: null,
      recordingFileId: null,
      model: null,
      promptVersion: null
    });
    await repository.saveCallAnalysisResult({
      callId: "CALL1",
      runId: "run-1",
      status: "ready",
      transcriptByRoles: [
        {
          role: "manager",
          start: 0,
          end: 2,
          text: "Добрый день."
        }
      ],
      fullTranscriptText: "Менеджер: Добрый день.",
      aiEvaluation: {
        score: 82,
        summary: "Менеджер начал разговор.",
        risks: ["Нет следующего шага."]
      },
      rawAiEvaluation: {
        score: 82,
        summary: "Менеджер начал разговор.",
        risks: ["Нет следующего шага."],
        providerOnlyDebug: {
          finishReason: "stop",
          safetyRatings: ["ok"]
        }
      },
      attributes: {
        managerName: "Мария",
        dealId: "23841",
        stageAtCallName: "Квалификация"
      },
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v1",
      analyzedAt: "2026-06-09T12:00:30.000Z",
      updatedAt: "2026-06-09T12:00:31.000Z"
    });
    await repository.finishCallAnalysisRun({
      runId: "run-1",
      finishedAt: "2026-06-09T12:00:31.000Z",
      status: "ready",
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v1",
      recordingSource: "bitrix_disk",
      recordingFileId: "338028"
    });

    await expect(repository.getLatestCallAnalysisRuns(["CALL1"])).resolves.toEqual([
      {
        callId: "CALL1",
        status: "ready",
        startedAt: "2026-06-09T12:00:00.000Z",
        finishedAt: "2026-06-09T12:00:31.000Z",
        model: "google/gemini-2.5-flash",
        promptVersion: "calls-v1",
        errorCode: null,
        errorMessage: null
      }
    ]);

    await expect(repository.getCallAnalysisResult("CALL1")).resolves.toEqual({
      callId: "CALL1",
      runId: "run-1",
      status: "ready",
      transcriptByRoles: [
        {
          role: "manager",
          start: 0,
          end: 2,
          text: "Добрый день."
        }
      ],
      fullTranscriptText: "Менеджер: Добрый день.",
      aiEvaluation: {
        score: 82,
        summary: "Менеджер начал разговор.",
        risks: ["Нет следующего шага."]
      },
      rawAiEvaluation: {
        score: 82,
        summary: "Менеджер начал разговор.",
        risks: ["Нет следующего шага."],
        providerOnlyDebug: {
          finishReason: "stop",
          safetyRatings: ["ok"]
        }
      },
      attributes: {
        managerName: "Мария",
        dealId: "23841",
        stageAtCallName: "Квалификация"
      },
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v1",
      analyzedAt: "2026-06-09T12:00:30.000Z",
      updatedAt: "2026-06-09T12:00:31.000Z"
    });
  });

  it("persists enrichment batches, proposals, and parsed proposal values", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(
      createEnrichmentBatch({
        proposals: [
          createEnrichmentProposal(),
          createEnrichmentProposal({
            id: "proposal-2",
            entityType: "deal",
            entityId: "deal-1",
            fieldCode: "UF_CRM_1766147164481",
            fieldTitle: "Ключевые проекты",
            actionType: "overwrite",
            currentValue: "Старый проект",
            proposedValue: "Новый завод",
            normalizedValue: "Новый завод",
            confidence: 0.78,
            evidenceSnippet: "Запускаем новый завод."
          })
        ]
      })
    );

    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toEqual({
      id: "batch-1",
      callId: "call-1",
      activityId: "activity-1",
      dealId: "deal-1",
      contactId: "contact-1",
      managerId: "manager-1",
      callAnalysisRunId: "run-1",
      status: "pending",
      expiresAt: "2026-06-30T10:00:00.000Z",
      telegramChatId: null,
      telegramMessageId: null,
      createdAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:00:00.000Z"
    });
    await expect(
      repository.getEnrichmentProposalBatchByCallId("call-1")
    ).resolves.toMatchObject({
      id: "batch-1",
      callId: "call-1"
    });
    await expect(repository.listEnrichmentProposals("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "proposal-1",
        batchId: "batch-1",
        entityType: "contact",
        currentValue: null,
        proposedValue: "500-1000 млн. рублей",
        normalizedValue: {
          id: "602",
          label: "500-1000 млн. рублей"
        }
      }),
      expect.objectContaining({
        id: "proposal-2",
        batchId: "batch-1",
        entityType: "deal",
        currentValue: "Старый проект",
        proposedValue: "Новый завод",
        normalizedValue: "Новый завод"
      })
    ]);
  });

  it("rejects duplicate enrichment batches for one call", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(createEnrichmentBatch());

    expect(() =>
      repository.createEnrichmentProposalBatch(
        createEnrichmentBatch({
          id: "batch-2",
          proposals: [
            createEnrichmentProposal({
              id: "proposal-2"
            })
          ]
        })
      )
    ).toThrow(/UNIQUE|constraint/i);
  });

  it("reads one enrichment proposal by id for writeback decisions", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(createEnrichmentBatch());

    await expect(repository.getEnrichmentProposal("proposal-1")).resolves.toEqual(
      expect.objectContaining({
        id: "proposal-1",
        batchId: "batch-1",
        entityType: "contact",
        fieldCode: "UF_CRM_1647946359",
        status: "pending"
      })
    );
    await expect(repository.getEnrichmentProposal("missing")).resolves.toBeNull();
  });

  it("persists telegram enrichment action tokens and delivery ids", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(createEnrichmentBatch());
    await repository.createTelegramEnrichmentActionToken({
      token: "token-1",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "approve",
      managerId: "manager-1",
      telegramChatId: "chat-1",
      expiresAt: "2026-06-30T10:00:00.000Z",
      createdAt: "2026-06-28T10:00:00.000Z"
    });
    await repository.updateEnrichmentProposalBatchTelegramMessage({
      batchId: "batch-1",
      telegramChatId: "chat-1",
      telegramMessageId: "42",
      updatedAt: "2026-06-28T10:01:00.000Z"
    });

    await expect(
      repository.getTelegramEnrichmentActionToken("token-1")
    ).resolves.toEqual({
      token: "token-1",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "approve",
      managerId: "manager-1",
      telegramChatId: "chat-1",
      expiresAt: "2026-06-30T10:00:00.000Z",
      usedAt: null,
      createdAt: "2026-06-28T10:00:00.000Z"
    });
    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toEqual(
      expect.objectContaining({
        telegramChatId: "chat-1",
        telegramMessageId: "42",
        updatedAt: "2026-06-28T10:01:00.000Z"
      })
    );
    await expect(
      repository.markTelegramEnrichmentActionTokenUsed({
        token: "token-1",
        usedAt: "2026-06-28T10:02:00.000Z"
      })
    ).resolves.toBe(true);
    await expect(
      repository.markTelegramEnrichmentActionTokenUsed({
        token: "token-1",
        usedAt: "2026-06-28T10:03:00.000Z"
      })
    ).resolves.toBe(false);
    await repository.releaseTelegramEnrichmentActionToken({
      token: "token-1",
      usedAt: "2026-06-28T10:03:00.000Z"
    });
    await expect(
      repository.getTelegramEnrichmentActionToken("token-1")
    ).resolves.toEqual(
      expect.objectContaining({
        usedAt: "2026-06-28T10:02:00.000Z"
      })
    );
    await repository.releaseTelegramEnrichmentActionToken({
      token: "token-1",
      usedAt: "2026-06-28T10:02:00.000Z"
    });
    await expect(
      repository.getTelegramEnrichmentActionToken("token-1")
    ).resolves.toEqual(
      expect.objectContaining({
        usedAt: null
      })
    );
    await expect(
      repository.markTelegramEnrichmentActionTokenUsed({
        token: "token-1",
        usedAt: "2026-06-28T10:04:00.000Z"
      })
    ).resolves.toBe(true);
  });

  it("records system and manager enrichment proposal events", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(createEnrichmentBatch());
    await repository.appendEnrichmentProposalEvent({
      id: "event-1",
      batchId: "batch-1",
      proposalId: null,
      actorType: "system",
      actorId: null,
      action: "batch.created",
      beforeStatus: null,
      afterStatus: "pending",
      reason: null,
      metadata: {
        source: "test"
      },
      createdAt: "2026-06-28T10:00:01.000Z"
    });
    await repository.markEnrichmentProposalDecision({
      proposalId: "proposal-1",
      status: "approved",
      actorId: "manager-1",
      decidedAt: "2026-06-28T10:05:00.000Z",
      eventId: "event-2",
      reason: "manager accepted"
    });

    await expect(repository.listEnrichmentProposalEvents("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "event-1",
        actorType: "system",
        action: "batch.created",
        metadata: {
          source: "test"
        }
      }),
      expect.objectContaining({
        id: "event-2",
        proposalId: "proposal-1",
        actorType: "manager",
        actorId: "manager-1",
        action: "proposal.approved",
        beforeStatus: "pending",
        afterStatus: "approved"
      })
    ]);
    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toEqual(
      expect.objectContaining({
        status: "approved"
      })
    );
  });

  it("keeps approved enrichment batches terminal when remaining proposals expire", async () => {
    const repository = createTempRepository();
    await repository.createEnrichmentProposalBatch(
      createEnrichmentBatch({
        proposals: [
          createEnrichmentProposal(),
          createEnrichmentProposal({
            id: "proposal-2",
            fieldCode: "UF_CRM_1712252375",
            fieldTitle: "Группа ЦА"
          })
        ]
      })
    );

    await repository.markEnrichmentProposalDecision({
      proposalId: "proposal-1",
      status: "approved",
      actorId: "manager-1",
      decidedAt: "2026-06-28T10:05:00.000Z",
      eventId: "event-1",
      reason: "telegram only"
    });
    await repository.expirePendingEnrichmentProposals({
      expiredAt: "2026-06-30T10:00:01.000Z"
    });

    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toEqual(
      expect.objectContaining({
        status: "approved"
      })
    );
    await expect(repository.getEnrichmentProposal("proposal-2")).resolves.toEqual(
      expect.objectContaining({
        status: "expired"
      })
    );
  });

  it("does not overwrite an already decided enrichment proposal", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(createEnrichmentBatch());
    await expect(
      repository.markEnrichmentProposalDecision({
        proposalId: "proposal-1",
        status: "approved",
        actorId: "manager-1",
        decidedAt: "2026-06-28T10:05:00.000Z",
        eventId: "event-1",
        reason: "first click"
      })
    ).resolves.toBe(true);
    await expect(
      repository.markEnrichmentProposalDecision({
        proposalId: "proposal-1",
        status: "declined",
        actorId: "manager-1",
        decidedAt: "2026-06-28T10:06:00.000Z",
        eventId: "event-2",
        reason: "second click"
      })
    ).resolves.toBe(false);

    await expect(repository.listEnrichmentProposals("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "proposal-1",
        status: "approved"
      })
    ]);
    await expect(repository.listEnrichmentProposalEvents("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "event-1",
        action: "proposal.approved"
      })
    ]);
  });

  it("expires pending enrichment proposals after the expiry timestamp", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(
      createEnrichmentBatch({
        expiresAt: "2026-06-30T10:00:00.000Z"
      })
    );
    await repository.expirePendingEnrichmentProposals({
      expiredAt: "2026-06-30T10:00:01.000Z"
    });

    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toMatchObject({
      status: "expired",
      updatedAt: "2026-06-30T10:00:01.000Z"
    });
    await expect(repository.listEnrichmentProposals("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "proposal-1",
        status: "expired",
        updatedAt: "2026-06-30T10:00:01.000Z"
      })
    ]);
    await expect(repository.listEnrichmentProposalEvents("batch-1")).resolves.toEqual([
      expect.objectContaining({
        action: "batch.expired",
        beforeStatus: "pending",
        afterStatus: "expired"
      })
    ]);
  });

  it("does not expire an already applied enrichment proposal", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(
      createEnrichmentBatch({
        expiresAt: "2026-06-30T10:00:00.000Z"
      })
    );
    await repository.markEnrichmentProposalApplied({
      proposalId: "proposal-1",
      appliedAt: "2026-06-29T10:00:00.000Z",
      eventId: "event-applied"
    });
    await repository.expirePendingEnrichmentProposals({
      expiredAt: "2026-06-30T10:00:01.000Z"
    });

    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toMatchObject({
      status: "applied",
      updatedAt: "2026-06-29T10:00:00.000Z"
    });
    await expect(repository.listEnrichmentProposals("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "proposal-1",
        status: "applied"
      })
    ]);
  });

  it("records conflict and failed statuses without losing proposed values", async () => {
    const repository = createTempRepository();

    await repository.createEnrichmentProposalBatch(
      createEnrichmentBatch({
        proposals: [
          createEnrichmentProposal(),
          createEnrichmentProposal({
            id: "proposal-2",
            fieldCode: "UF_CRM_1643816950",
            fieldTitle: "Цели/задачи по клубу",
            proposedValue: "Найти партнеров",
            normalizedValue: "Найти партнеров"
          })
        ]
      })
    );
    await repository.markEnrichmentProposalFailed({
      proposalId: "proposal-1",
      status: "conflict",
      failedAt: "2026-06-28T10:10:00.000Z",
      eventId: "event-conflict",
      reason: "current value changed"
    });
    await repository.markEnrichmentProposalFailed({
      proposalId: "proposal-2",
      status: "failed",
      failedAt: "2026-06-28T10:11:00.000Z",
      eventId: "event-failed",
      reason: "bitrix rejected"
    });

    await expect(repository.listEnrichmentProposals("batch-1")).resolves.toEqual([
      expect.objectContaining({
        id: "proposal-1",
        status: "conflict",
        proposedValue: "500-1000 млн. рублей",
        normalizedValue: {
          id: "602",
          label: "500-1000 млн. рублей"
        }
      }),
      expect.objectContaining({
        id: "proposal-2",
        status: "failed",
        proposedValue: "Найти партнеров",
        normalizedValue: "Найти партнеров"
      })
    ]);
    await expect(repository.getEnrichmentProposalBatch("batch-1")).resolves.toMatchObject({
      status: "failed"
    });
  });

  it("resolves the deal stage at call time by actual timestamp instead of lexical timestamp order", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertStageHistory([
      {
        id: "stage-before",
        ownerId: "23841",
        categoryId: "10",
        stageId: "C10:BEFORE",
        stageSemanticId: "P",
        typeId: null,
        createdTime: "2026-06-09T21:00:00.000+03:00"
      },
      {
        id: "stage-after",
        ownerId: "23841",
        categoryId: "10",
        stageId: "C10:AFTER",
        stageSemanticId: "P",
        typeId: null,
        createdTime: "2026-06-09T22:00:00.000Z"
      }
    ]);

    await expect(
      repository.getStageAtDealTime("23841", "2026-06-09T23:00:00.000+03:00")
    ).resolves.toMatchObject({
      id: "stage-before",
      stageId: "C10:BEFORE"
    });
  });

  it("persists unit economics articles, rules and active cost facts by period", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await expect(repository.getUnitEconomicsCostArticles()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "lead_purchase",
          name: "Закупка лидов",
          pnlLevel: "variable_contribution",
          calculationMethod: "amount_per_lead"
        }),
        expect.objectContaining({
          id: "contractation",
          name: "Контрактация",
          pnlLevel: "variable_contribution",
          calculationMethod: "amount_per_contract",
          effectiveFrom: "2025-07-01"
        }),
        expect.objectContaining({
          id: "demo_events",
          pnlLevel: "variable_contribution",
          calculationMethod: "amount_per_participant"
        }),
        expect.objectContaining({
          id: "it_service",
          name: "IT-сервис",
          pnlLevel: "above_ebitda"
        })
      ])
    );

    await expect(repository.getUnitEconomicsCostRules()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "leadgen-us-ready-to-meet-default",
          articleId: "lead_purchase",
          pnlLevel: "variable_contribution",
          unitPrice: 20_000,
          qualityValue: "Готов к встрече",
          effectiveFrom: "2025-07-01",
          enabled: true
        }),
        expect.objectContaining({
          id: "guest-meeting-participant-default",
          articleId: "demo_events",
          pnlLevel: "variable_contribution",
          unitPrice: 5_000,
          eventNamePattern: "Гостевая встреча",
          enabled: true
        }),
        expect.objectContaining({
          id: "other-conversion-event-participant-default",
          articleId: "demo_events",
          pnlLevel: "variable_contribution",
          unitPrice: 15_000,
          eventNamePattern: null,
          enabled: true
        }),
        expect.objectContaining({
          id: "leadgen-us-attended-meeting-default",
          articleId: "lead_purchase",
          pnlLevel: "variable_contribution",
          unitPrice: 40_000,
          qualityValue: "Пришёл на встречу",
          enabled: true
        })
      ])
    );

    await expect(repository.getUnitEconomicsEventParticipantMode()).resolves.toBe(
      "invited"
    );

    await repository.replaceUnitEconomicsCostRules({
      updatedAt: "2026-06-02T08:00:00.000Z",
      rules: [
        {
          id: "leadgen-ready-to-meet",
          articleId: "lead_purchase",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_lead",
          unitPrice: 40_000,
          percent: null,
          amount: null,
          sourceKey: "LEADGEN_US",
          qualityValue: "Готов к встрече",
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        },
        {
          id: "contractation-per-won",
          articleId: "contractation",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_contract",
          unitPrice: 5_000,
          percent: null,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 20
        }
      ]
    });

    await repository.upsertUnitEconomicsCostFacts([
      {
        id: "facility-april",
        articleId: "facility_aho",
        pnlLevel: "above_ebitda",
        costBehavior: "fixed",
        calculationMethod: "manual_amount",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        amount: 31_500,
        currency: "RUB",
        quantity: 1,
        sourceSystem: "manual",
        sourceReference: "unitka-priv-april",
        confidence: "manual",
        status: "active",
        comment: "Офис и переговорки"
      },
      {
        id: "facility-may",
        articleId: "facility_aho",
        pnlLevel: "above_ebitda",
        costBehavior: "fixed",
        calculationMethod: "manual_amount",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        amount: 32_000,
        currency: "RUB",
        quantity: 1,
        sourceSystem: "manual",
        sourceReference: "unitka-priv-may",
        confidence: "manual",
        status: "active",
        comment: null
      }
    ]);

    await expect(repository.getUnitEconomicsCostRules()).resolves.toEqual([
      expect.objectContaining({
        id: "leadgen-ready-to-meet",
        articleId: "lead_purchase",
        sourceKey: "LEADGEN_US",
        qualityValue: "Готов к встрече",
        unitPrice: 40_000,
        enabled: true
      }),
      expect.objectContaining({
        id: "contractation-per-won",
        articleId: "contractation",
        unitPrice: 5_000,
        enabled: true
      })
    ]);

    await expect(
      repository.getUnitEconomicsCostFacts({
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "facility-april",
        articleId: "facility_aho",
        amount: 31_500,
        sourceReference: "unitka-priv-april",
        comment: "Офис и переговорки"
      })
    ]);
  });

  it("persists prototype comments with block anchors", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.replaceProtoComments({
      updatedAt: "2026-05-02T08:00:00.000Z",
      comments: [
        {
          id: "comment-1",
          sceneId: "sales-report",
          x: 0.25,
          y: 0.5,
          text: "Проверить карточку продаж",
          status: "open",
          archivedAt: null,
          createdAt: "2026-05-02T07:59:00.000Z",
          updatedAt: "2026-05-02T08:00:00.000Z",
          anchor: {
            blockId: "sales-summary-card",
            blockLabel: "Выиграно",
            blockSelector: '[data-comment-block-id="sales-summary-card"]',
            blockRole: "section",
            elementSelector: "section:nth-of-type(2) > div:nth-of-type(1)",
            elementLabel: "Выиграно 1",
            relativeX: 0.1,
            relativeY: 0.2
          }
        }
      ]
    });

    await expect(repository.getProtoComments()).resolves.toEqual({
      updatedAt: "2026-05-02T08:00:00.000Z",
      comments: [
        expect.objectContaining({
          id: "comment-1",
          text: "Проверить карточку продаж",
          anchor: expect.objectContaining({
            blockId: "sales-summary-card",
            blockLabel: "Выиграно",
            relativeX: 0.1,
            relativeY: 0.2
          })
        })
      ]
    });
  });

  it("persists conversion event visit snapshots without raw client names", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertConversionEventVisits([
      {
        id: "VISIT-1",
        eventId: null,
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "attended",
        stageId: "DT:ATTENDED",
        stageName: "На мероприятии",
        dealId: "146166",
        contactId: "9001",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T13:56:00.000Z"
      }
    ]);

    await expect(repository.getAllConversionEventVisits()).resolves.toEqual([
      {
        id: "VISIT-1",
        eventId: null,
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "attended",
        stageId: "DT:ATTENDED",
        stageName: "На мероприятии",
        dealId: "146166",
        contactId: "9001",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T13:56:00.000Z"
      }
    ]);
  });

  it("prunes conversion event snapshots outside scoped participants while preserving referenced participant events", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertConversionEventVisits([
      {
        id: "VISIT-DIRECT",
        eventId: "EVENT-ALLOWED",
        eventName: "Гостевая встреча 28.05.",
        eventDate: "2026-05-28T00:00:00.000Z",
        status: "invited",
        stageId: "DT:NEW",
        stageName: "Приглашен",
        dealId: "D1",
        contactId: "C1",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-05-20T10:00:00.000Z",
        updatedTime: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "VISIT-CONTACT-ONLY",
        eventId: "EVENT-CLUB",
        eventName: "Клубная активность",
        eventDate: "2026-06-01T00:00:00.000Z",
        status: "invited",
        stageId: "DT:NEW",
        stageName: "Приглашен",
        dealId: null,
        contactId: "C1",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-05-20T11:00:00.000Z",
        updatedTime: "2026-05-20T11:00:00.000Z"
      },
      {
        id: "VISIT-OTHER-DEAL",
        eventId: "EVENT-CLUB",
        eventName: "Клубная активность",
        eventDate: "2026-06-02T00:00:00.000Z",
        status: "attended",
        stageId: "DT:ATTENDED",
        stageName: "Пришел",
        dealId: "D2",
        contactId: "C2",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-05-20T12:00:00.000Z",
        updatedTime: "2026-05-20T12:00:00.000Z"
      }
    ]);

    await repository.upsertEventVisitStageHistory([
      {
        historyId: "H-DIRECT",
        visitId: "VISIT-DIRECT",
        entityTypeId: 162,
        categoryId: 14,
        stageId: "DT:NEW",
        stageName: "Приглашен",
        typeId: 1,
        changedAt: "2026-05-20T10:00:00.000Z"
      },
      {
        historyId: "H-CONTACT",
        visitId: "VISIT-CONTACT-ONLY",
        entityTypeId: 162,
        categoryId: 14,
        stageId: "DT:NEW",
        stageName: "Приглашен",
        typeId: 1,
        changedAt: "2026-05-20T11:00:00.000Z"
      },
      {
        historyId: "H-OTHER",
        visitId: "VISIT-OTHER-DEAL",
        entityTypeId: 162,
        categoryId: 14,
        stageId: "DT:ATTENDED",
        stageName: "Пришел",
        typeId: 2,
        changedAt: "2026-05-20T12:00:00.000Z"
      }
    ]);

    await repository.upsertEventSnapshots([
      {
        eventId: "EVENT-ALLOWED",
        entityTypeId: 137,
        categoryId: 12,
        title: "Гостевая встреча 28.05.",
        eventDate: "2026-05-28T00:00:00.000Z",
        startAt: null,
        endAt: null,
        stageId: "DT137_12:PLANNED",
        stageName: "Планируется",
        status: "planned",
        eventTypeId: "128",
        eventTypeLabel: "Мероприятие Привлечения",
        formatId: null,
        createdTime: "2026-05-14T08:18:44.000Z",
        updatedTime: "2026-05-19T20:57:57.000Z"
      },
      {
        eventId: "EVENT-CLUB",
        entityTypeId: 137,
        categoryId: 12,
        title: "Клубная активность",
        eventDate: "2026-06-01T00:00:00.000Z",
        startAt: null,
        endAt: null,
        stageId: "DT137_12:PLANNED",
        stageName: "Планируется",
        status: "planned",
        eventTypeId: "999",
        eventTypeLabel: "Клубная активность",
        formatId: null,
        createdTime: "2026-05-14T08:18:44.000Z",
        updatedTime: "2026-05-19T20:57:57.000Z"
      }
    ]);

    await repository.upsertEventVisitFacts([
      {
        visitId: "VISIT-DIRECT",
        eventId: "EVENT-ALLOWED",
        dealId: "D1",
        contactId: "C1",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        currentStageId: "DT:NEW",
        currentStageName: "Приглашен",
        invitedAt: "2026-05-20T10:00:00.000Z",
        confirmedAt: null,
        attendedAt: null,
        refusedAt: null,
        finalStatus: "invited",
        eventDate: "2026-05-28T00:00:00.000Z",
        stageIdAtEvent: "C10:NEW",
        linkConfidence: "high",
        linkReason: "event_visit_deal",
        payloadJson: null
      },
      {
        visitId: "VISIT-CONTACT-ONLY",
        eventId: "EVENT-CLUB",
        dealId: "D1",
        contactId: "C1",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        currentStageId: "DT:NEW",
        currentStageName: "Приглашен",
        invitedAt: "2026-05-20T11:00:00.000Z",
        confirmedAt: null,
        attendedAt: null,
        refusedAt: null,
        finalStatus: "invited",
        eventDate: "2026-06-01T00:00:00.000Z",
        stageIdAtEvent: "C10:NEW",
        linkConfidence: "medium",
        linkReason: "contact_single_deal_fallback",
        payloadJson: null
      },
      {
        visitId: "VISIT-OTHER-DEAL",
        eventId: "EVENT-CLUB",
        dealId: "D2",
        contactId: "C2",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        currentStageId: "DT:ATTENDED",
        currentStageName: "Пришел",
        invitedAt: "2026-05-20T12:00:00.000Z",
        confirmedAt: null,
        attendedAt: "2026-06-02T00:00:00.000Z",
        refusedAt: null,
        finalStatus: "attended",
        eventDate: "2026-06-02T00:00:00.000Z",
        stageIdAtEvent: null,
        linkConfidence: "low",
        linkReason: "event_visit_deal_out_of_scope",
        payloadJson: null
      }
    ]);

    await repository.upsertDealTouchpointFacts([
      {
        factId: "event:VISIT-DIRECT",
        kind: "conversion_event_visit",
        sourceSystem: "bitrix24",
        sourceEntityType: "conversion_event_visit",
        sourceEntityId: "VISIT-DIRECT",
        occurredAt: "2026-05-20T10:00:00.000Z",
        dealId: "D1",
        contactId: "C1",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        stageIdAtEvent: "C10:NEW",
        stageNameAtEvent: "Новая",
        linkConfidence: "high",
        linkReason: "event_visit_deal",
        payloadJson: null
      },
      {
        factId: "event:VISIT-CONTACT-ONLY",
        kind: "conversion_event_visit",
        sourceSystem: "bitrix24",
        sourceEntityType: "conversion_event_visit",
        sourceEntityId: "VISIT-CONTACT-ONLY",
        occurredAt: "2026-05-20T11:00:00.000Z",
        dealId: "D1",
        contactId: "C1",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        stageIdAtEvent: "C10:NEW",
        stageNameAtEvent: "Новая",
        linkConfidence: "medium",
        linkReason: "contact_single_deal_fallback",
        payloadJson: null
      },
      {
        factId: "event:VISIT-OTHER-DEAL",
        kind: "conversion_event_visit",
        sourceSystem: "bitrix24",
        sourceEntityType: "conversion_event_visit",
        sourceEntityId: "VISIT-OTHER-DEAL",
        occurredAt: "2026-05-20T12:00:00.000Z",
        dealId: "D2",
        contactId: "C2",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        stageIdAtEvent: null,
        stageNameAtEvent: null,
        linkConfidence: "low",
        linkReason: "event_visit_deal_out_of_scope",
        payloadJson: null
      },
      {
        factId: "call:CALL-1",
        kind: "call",
        sourceSystem: "bitrix24",
        sourceEntityType: "call",
        sourceEntityId: "CALL-1",
        occurredAt: "2026-05-20T13:00:00.000Z",
        dealId: "D2",
        contactId: "C2",
        leadId: null,
        managerId: "78",
        sourceId: "WEB",
        stageIdAtEvent: "C10:NEW",
        stageNameAtEvent: "Новая",
        linkConfidence: "high",
        linkReason: "activity_owner_deal",
        payloadJson: null
      }
    ]);

    await expect(
      repository.pruneConversionEventSnapshots({
        scopedDealIds: ["D1"],
        enabledEventTypeIds: ["128"]
      })
    ).resolves.toEqual({
      conversionEventVisits: 2,
      eventVisitStageHistory: 2,
      eventVisitFacts: 2,
      dealTouchpointFacts: 2,
      eventSnapshots: 1
    });

    await expect(repository.getAllConversionEventVisits()).resolves.toEqual([
      expect.objectContaining({ id: "VISIT-DIRECT", dealId: "D1" })
    ]);
    await expect(repository.getAllEventVisitStageHistory()).resolves.toEqual([
      expect.objectContaining({ historyId: "H-DIRECT", visitId: "VISIT-DIRECT" })
    ]);
    await expect(repository.getAllEventVisitFacts()).resolves.toEqual([
      expect.objectContaining({ visitId: "VISIT-DIRECT", dealId: "D1" })
    ]);
    await expect(repository.getAllDealTouchpointFacts()).resolves.toEqual([
      expect.objectContaining({ factId: "event:VISIT-DIRECT" }),
      expect.objectContaining({ factId: "call:CALL-1" })
    ]);
    await expect(repository.getAllEventSnapshots()).resolves.toEqual([
      expect.objectContaining({ eventId: "EVENT-ALLOWED", eventTypeId: "128" })
    ]);
  });

  it("keeps planned event snapshots when no planned event types are configured yet", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertEventSnapshots([
      {
        eventId: "31394",
        entityTypeId: 137,
        categoryId: 12,
        title: "Гостевая встреча 28.05.",
        eventDate: "2026-05-28T00:00:00.000Z",
        startAt: null,
        endAt: null,
        stageId: "DT137_12:PLANNED",
        stageName: "Планируется",
        status: "planned",
        eventTypeId: "128",
        eventTypeLabel: "Мероприятие Привлечения",
        formatId: null,
        createdTime: "2026-05-14T08:18:44.000Z",
        updatedTime: "2026-05-19T20:57:57.000Z"
      }
    ]);

    await expect(
      repository.pruneConversionEventSnapshots({
        scopedDealIds: ["D1"],
        enabledEventTypeIds: []
      })
    ).resolves.toEqual({
      conversionEventVisits: 0,
      eventVisitStageHistory: 0,
      eventVisitFacts: 0,
      dealTouchpointFacts: 0,
      eventSnapshots: 0
    });

    await expect(repository.getAllEventSnapshots()).resolves.toEqual([
      expect.objectContaining({
        eventId: "31394",
        title: "Гостевая встреча 28.05."
      })
    ]);
  });

  it("reconciles conversion visit dates from authoritative event snapshots", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertConversionEventVisits([
      {
        id: "311478",
        eventId: "2192",
        eventName:
          "МСК Гость Клуба: Александр Аузан 17.10.23 Александр Аузан оффлайн",
        eventDate: "2026-10-17T00:00:00.000Z",
        status: "attended",
        stageId: "DT162_14:SUCCESS",
        stageName: "На мероприятии",
        dealId: "105712",
        contactId: "0",
        managerId: "78",
        sourceId: null,
        createdTime: "2023-10-23T10:04:20+03:00",
        updatedTime: "2023-10-23T10:04:20+03:00"
      }
    ]);

    await repository.upsertEventSnapshots([
      {
        eventId: "2192",
        entityTypeId: 137,
        categoryId: 12,
        title: "МСК Гость Клуба: Александр Аузан 17.10.23 Александр Аузан оффлайн",
        eventDate: "2023-10-17T00:00:00.000Z",
        startAt: "2023-10-17T00:00:00.000Z",
        endAt: null,
        stageId: "DT137_12:COMPLETED",
        stageName: "Проведено",
        status: "completed",
        eventTypeId: "128",
        eventTypeLabel: "Мероприятие Привлечения",
        formatId: null,
        createdTime: "2023-10-01T10:00:00.000Z",
        updatedTime: "2023-10-18T10:00:00.000Z"
      }
    ]);

    await expect(repository.getAllConversionEventVisits()).resolves.toEqual([
      expect.objectContaining({
        id: "311478",
        eventDate: "2023-10-17T00:00:00.000Z"
      })
    ]);
  });

  it("persists canonical identity, touchpoint and event facts without raw personal data", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertIdentityLinks([
      {
        identityId: "identity:deal:156562",
        moduleKey: "attraction",
        dealId: "156562",
        leadId: "900",
        contactId: "321",
        dealCategoryId: "10",
        leadCategoryId: null,
        currentManagerId: "13020",
        currentStageId: "C10:DEMO",
        sourceId: "REPEAT_SALE",
        createdAt: "2026-05-13T10:00:00.000Z",
        updatedAt: "2026-05-18T15:41:58.000Z",
        linkConfidence: "high",
        linkReason: "deal_snapshot"
      }
    ]);

    await repository.upsertDealStageFacts([
      {
        factId: "stage:deal:156562:stage-1",
        sourceSystem: "bitrix24",
        sourceEntityId: "stage-1",
        dealId: "156562",
        contactId: "321",
        leadId: "900",
        categoryId: "10",
        stageId: "C10:DEMO",
        stageName: "Демонстрация",
        stageSemanticId: "P",
        enteredAt: "2026-05-18T12:00:00.000Z",
        leftAt: null,
        managerId: "13020",
        sourceId: "REPEAT_SALE",
        sortOrder: 40,
        payloadJson: null
      }
    ]);

    await repository.upsertDealTouchpointFacts([
      {
        factId: "call:CALL-1",
        kind: "call",
        sourceSystem: "bitrix24",
        sourceEntityType: "call",
        sourceEntityId: "CALL-1",
        occurredAt: "2026-05-18T13:00:00.000Z",
        dealId: "156562",
        contactId: "321",
        leadId: "900",
        managerId: "13020",
        sourceId: "REPEAT_SALE",
        stageIdAtEvent: "C10:DEMO",
        stageNameAtEvent: "Демонстрация",
        linkConfidence: "high",
        linkReason: "activity_owner_deal",
        payloadJson: JSON.stringify({
          durationSeconds: 95,
          connected: true
        })
      }
    ]);

    await repository.upsertEventSnapshots([
      {
        eventId: "31394",
        entityTypeId: 137,
        categoryId: 12,
        title: "Гостевая встреча 28.05.",
        eventDate: "2026-05-28T00:00:00.000Z",
        startAt: null,
        endAt: null,
        stageId: "DT137_12:UC_9FT1X8",
        stageName: "Планируется",
        status: "planned",
        eventTypeId: "128",
        eventTypeLabel: "Мероприятие Привлечения",
        formatId: "2788",
        createdTime: "2026-05-14T08:18:44.000Z",
        updatedTime: "2026-05-19T20:57:57.000Z"
      }
    ]);

    await repository.upsertEventVisitFacts([
      {
        visitId: "455358",
        eventId: "29402",
        dealId: "156562",
        contactId: "321",
        leadId: "900",
        managerId: "13020",
        sourceId: "REPEAT_SALE",
        currentStageId: "DT162_14:NEW",
        currentStageName: "Приглашен",
        invitedAt: "2026-05-18T15:41:58.000Z",
        confirmedAt: null,
        attendedAt: null,
        refusedAt: null,
        finalStatus: "invited",
        eventDate: "2026-05-21T00:00:00.000Z",
        stageIdAtEvent: "C10:DEMO",
        linkConfidence: "high",
        linkReason: "visit_parent_deal",
        payloadJson: null
      }
    ]);

    await repository.upsertEventVisitStageHistory([
      {
        historyId: "147080",
        visitId: "455358",
        entityTypeId: 162,
        categoryId: 14,
        stageId: "DT162_14:NEW",
        stageName: "Приглашен",
        typeId: 1,
        changedAt: "2026-05-18T15:41:58.000Z"
      }
    ]);

    await repository.replaceConversionEventTypeOptions([
      {
        id: "128",
        title: "Мероприятие Привлечения",
        categoryId: 30,
        stageId: null,
        selectedForPlannedInventory: true
      }
    ]);

    await repository.replaceModuleEventTypeSettings({
      moduleKey: "attraction",
      rows: [
        {
          moduleKey: "attraction",
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие Привлечения",
          enabled: true,
          updatedAt: "2026-05-24T12:00:00.000Z"
        }
      ]
    });

    await expect(repository.getAllIdentityLinks()).resolves.toEqual([
      expect.objectContaining({
        identityId: "identity:deal:156562",
        dealId: "156562",
        contactId: "321",
        linkReason: "deal_snapshot"
      })
    ]);
    await expect(repository.getAllDealStageFacts()).resolves.toEqual([
      expect.objectContaining({
        factId: "stage:deal:156562:stage-1",
        stageName: "Демонстрация"
      })
    ]);
    await expect(repository.getAllDealTouchpointFacts()).resolves.toEqual([
      expect.objectContaining({
        factId: "call:CALL-1",
        kind: "call",
        payloadJson: JSON.stringify({
          durationSeconds: 95,
          connected: true
        })
      })
    ]);
    await expect(repository.getAllEventSnapshots()).resolves.toEqual([
      expect.objectContaining({
        eventId: "31394",
        eventTypeId: "128",
        status: "planned"
      })
    ]);
    await expect(repository.getAllEventVisitFacts()).resolves.toEqual([
      expect.objectContaining({
        visitId: "455358",
        finalStatus: "invited",
        linkReason: "visit_parent_deal"
      })
    ]);
    await expect(repository.getAllEventVisitStageHistory()).resolves.toEqual([
      expect.objectContaining({
        historyId: "147080",
        stageName: "Приглашен"
      })
    ]);
    await expect(repository.getConversionEventTypeOptions()).resolves.toEqual([
      expect.objectContaining({
        id: "128",
        selectedForPlannedInventory: true
      })
    ]);
    await expect(
      repository.getModuleEventTypeSettings("attraction")
    ).resolves.toEqual([
      expect.objectContaining({
        eventTypeId: "128",
        enabled: true
      })
    ]);

    await expect(
      repository.replaceAnalyticsFacts({
        identityLinks: [],
        dealStageFacts: [],
        dealTouchpointFacts: [],
        eventVisitFacts: []
      })
    ).resolves.toEqual({
      identityLinks: 0,
      dealStageFacts: 0,
      dealTouchpointFacts: 0,
      eventVisitFacts: 0
    });
    await expect(repository.getAllIdentityLinks()).resolves.toEqual([]);
    await expect(repository.getAllDealStageFacts()).resolves.toEqual([]);
    await expect(repository.getAllDealTouchpointFacts()).resolves.toEqual([]);
    await expect(repository.getAllEventVisitFacts()).resolves.toEqual([]);
    await expect(repository.getAllEventSnapshots()).resolves.toEqual([
      expect.objectContaining({
        eventId: "31394"
      })
    ]);
  });

  it("persists deal contact id and conversion event fallback value", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertDeals([
      {
        id: "D_EVENT",
        title: null,
        contactId: "C900",
        leadId: null,
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "78",
        sourceId: "WEB",
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: null,
        meetingDateValue: null,
        tariffValue: null,
        conversionEventValue: "Знакомство с клубом 29.04.",
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-20T00:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await expect(repository.getAllDeals()).resolves.toEqual([
      expect.objectContaining({
        id: "D_EVENT",
        contactId: "C900",
        conversionEventValue: "Знакомство с клубом 29.04."
      })
    ]);
  });

  it("persists and replaces deal meeting slots independently from legacy slot one fields", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.upsertDeals([
      {
        id: "D_MEETING_SLOTS",
        title: null,
        contactId: null,
        leadId: null,
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "78",
        sourceId: "WEB",
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-05-04T10:00:00.000Z",
        meetingSlots: [
          {
            index: 2,
            dateValue: "2026-05-06T10:00:00.000Z",
            typeValue: "Zoom",
            placeValue: "Офис К2",
            calendarValue: "Календарь клуба",
            eventId: "event-2",
            source: "deal_fields"
          },
          {
            index: 1,
            dateValue: "2026-05-04T10:00:00.000Z",
            typeValue: "Очная",
            placeValue: "Офис К1",
            calendarValue: "Основной календарь",
            eventId: null,
            source: "deal_fields"
          }
        ],
        tariffValue: null,
        conversionEventValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2026-05-01T00:00:00.000Z",
        dateModify: "2026-05-07T00:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await expect(repository.getDealsByIds(["D_MEETING_SLOTS"])).resolves.toEqual([
      expect.objectContaining({
        id: "D_MEETING_SLOTS",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-05-04T10:00:00.000Z",
        meetingSlots: [
          expect.objectContaining({ index: 1, typeValue: "Очная" }),
          expect.objectContaining({ index: 2, typeValue: "Zoom" })
        ]
      })
    ]);

    await repository.upsertDeals([
      {
        id: "D_MEETING_SLOTS",
        title: null,
        contactId: null,
        leadId: null,
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "78",
        sourceId: "WEB",
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-05-04T10:00:00.000Z",
        meetingSlots: [
          {
            index: 1,
            dateValue: "2026-05-04T10:00:00.000Z",
            typeValue: "Очная",
            placeValue: "Офис К1",
            calendarValue: "Основной календарь",
            eventId: null,
            source: "deal_fields"
          }
        ],
        tariffValue: null,
        conversionEventValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2026-05-01T00:00:00.000Z",
        dateModify: "2026-05-08T00:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await expect(repository.getAllDeals()).resolves.toEqual([
      expect.objectContaining({
        id: "D_MEETING_SLOTS",
        meetingSlots: [expect.objectContaining({ index: 1 })]
      })
    ]);
  });

  it("seeds and replaces attraction pricing rules", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    const seeded = await repository.getPricingRules();
    expect(seeded.map((rule) => [rule.id, rule.attractionRevenueAmount])).toEqual([
      ["clubfirst-federal", 300000],
      ["clubfirst-regional", 225000],
      ["clubfirst-globall", 150000],
      ["clubfirst-future", 181000]
    ]);

    await repository.replacePricingRules({
      updatedAt: "2026-04-29T10:00:00.000Z",
      rules: seeded.map((rule) =>
        rule.id === "clubfirst-federal"
          ? { ...rule, attractionRevenueAmount: 310000 }
          : rule
      )
    });

    await expect(repository.getPricingRules()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "clubfirst-federal",
          attractionRevenueAmount: 310000,
          updatedAt: "2026-04-29T10:00:00.000Z"
        })
      ])
    );
  });

  it("seeds and replaces operational threshold settings", async () => {
    const repository = createTempRepository();

    const seeded = await repository.getOperationalThresholdSettings();
    expect(seeded).toMatchObject({
      noCallsMaxDays: 7,
      noActivityMaxDays: 5,
      slaBusinessHours: {
        sla1: 24,
        sla2: 5,
        sla3: 72
      },
      updatedAt: null
    });
    expect(seeded.stageAging).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageId: "C10:NEW",
          stageName: "База входящая",
          maxDaysOnStage: 1
        }),
        expect.objectContaining({
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          maxDaysOnStage: 3
        })
      ])
    );

    await repository.replaceOperationalThresholdSettings({
      stageAging: [
        {
          stageId: "C10:NEW",
          maxDaysOnStage: 2
        },
        {
          stageId: "C10:PREPARATION",
          maxDaysOnStage: 4
        }
      ],
      noCallsMaxDays: 6,
      noActivityMaxDays: 4,
      slaBusinessHours: {
        sla1: 20,
        sla2: 6,
        sla3: 60
      },
      updatedAt: "2026-04-29T10:00:00.000Z"
    });

    const updated = await repository.getOperationalThresholdSettings();
    expect(updated).toMatchObject({
      noCallsMaxDays: 6,
      noActivityMaxDays: 4,
      slaBusinessHours: {
        sla1: 20,
        sla2: 6,
        sla3: 60
      },
      updatedAt: "2026-04-29T10:00:00.000Z"
    });
    expect(updated.stageAging).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageId: "C10:NEW",
          stageName: "База входящая",
          maxDaysOnStage: 2
        }),
        expect.objectContaining({
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          maxDaysOnStage: 4
        }),
        expect.objectContaining({
          stageId: "C10:UC_9E0XYG",
          stageName: "Встреча-знакомство",
          maxDaysOnStage: 14
        })
      ])
    );
  });

  it("seeds and replaces attraction manager whitelist settings", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    const seeded = await (repository as any).getManagerWhitelistSettings("attraction");
    expect(seeded.map((row: { managerId: string }) => row.managerId)).toEqual(
      ATTRACTION_MANAGER_IDS
    );

    await (repository as any).replaceManagerWhitelistSettings({
      moduleKey: "attraction",
      managerIds: ["13020", "78"],
      updatedAt: "2026-06-01T10:00:00.000Z"
    });

    await expect(
      (repository as any).getManagerWhitelistSettings("attraction")
    ).resolves.toEqual([
      expect.objectContaining({
        moduleKey: "attraction",
        managerId: "13020",
        managerName: "Какулия Илья",
        enabled: true,
        sortOrder: 0,
        updatedAt: "2026-06-01T10:00:00.000Z"
      }),
      expect.objectContaining({
        moduleKey: "attraction",
        managerId: "78",
        managerName: "Егоров Андрей",
        enabled: true,
        sortOrder: 10,
        updatedAt: "2026-06-01T10:00:00.000Z"
      })
    ]);
  });

  it("replaces and reads sales plan rows for a period", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([]);

    await repository.replaceSalesPlanRows({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      updatedAt: "2026-04-10T12:00:00.000Z",
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          plannedDeals: 3,
          plannedAmount: 2500000
        },
        {
          managerId: "81",
          managerName: "Ромашова Ольга",
          targetGroupKey: "ClubFirst Future",
          targetGroupLabel: "ClubFirst Future",
          plannedDeals: 2,
          plannedAmount: 1800000
        }
      ]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "78",
        managerName: "Егоров Андрей",
        targetGroupKey: "ClubFirst Russia",
        targetGroupLabel: "ClubFirst Russia",
        plannedDeals: 3,
        plannedAmount: 2500000,
        updatedAt: "2026-04-10T12:00:00.000Z"
      },
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "81",
        managerName: "Ромашова Ольга",
        targetGroupKey: "ClubFirst Future",
        targetGroupLabel: "ClubFirst Future",
        plannedDeals: 2,
        plannedAmount: 1800000,
        updatedAt: "2026-04-10T12:00:00.000Z"
      }
    ]);

    await repository.replaceSalesPlanRows({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      updatedAt: "2026-04-11T12:00:00.000Z",
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          plannedDeals: 4,
          plannedAmount: 3000000
        }
      ]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "78",
        managerName: "Егоров Андрей",
        targetGroupKey: "ClubFirst Russia",
        targetGroupLabel: "ClubFirst Russia",
        plannedDeals: 4,
        plannedAmount: 3000000,
        updatedAt: "2026-04-11T12:00:00.000Z"
      }
    ]);
  });

  it("replaces sales plan rows for multiple periods atomically", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await repository.replaceSalesPlanPeriods({
      updatedAt: "2026-04-10T12:00:00.000Z",
      periods: [
        {
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00",
          rows: [
            {
              managerId: "78",
              managerName: "Егоров Андрей",
              targetGroupKey: "ClubFirst Russia",
              targetGroupLabel: "ClubFirst Russia",
              plannedDeals: 3,
              plannedAmount: 3000000
            }
          ]
        },
        {
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00",
          rows: [
            {
              managerId: "78",
              managerName: "Егоров Андрей",
              targetGroupKey: "ClubFirst Russia",
              targetGroupLabel: "ClubFirst Russia",
              plannedDeals: 9,
              plannedAmount: 9000000
            }
          ]
        }
      ]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "78",
        managerName: "Егоров Андрей",
        targetGroupKey: "ClubFirst Russia",
        targetGroupLabel: "ClubFirst Russia",
        plannedDeals: 3,
        plannedAmount: 3000000,
        updatedAt: "2026-04-10T12:00:00.000Z"
      }
    ]);

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-06-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-06-30T23:59:59.999+03:00",
        managerId: "78",
        managerName: "Егоров Андрей",
        targetGroupKey: "ClubFirst Russia",
        targetGroupLabel: "ClubFirst Russia",
        plannedDeals: 9,
        plannedAmount: 9000000,
        updatedAt: "2026-04-10T12:00:00.000Z"
      }
    ]);
  });

  it("finds a successful compatible scope when manager coverage expands", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    const oldScopeRunId = await repository.createSyncRun({
      startedAt: "2026-04-26T21:00:00.000Z",
      mode: "delta",
      modifiedAfter: "2026-04-26T20:00:00.000Z",
      scopeKey: "category:10:assigned:78"
    });
    await repository.finishSyncRun({
      syncRunId: oldScopeRunId,
      finishedAt: "2026-04-26T21:00:05.000Z",
      status: "success",
      leadsSynced: 0,
      dealsSynced: 0,
      modifiedAfter: "2026-04-26T20:00:00.000Z"
    });
    const failedExpandedRunId = await repository.createSyncRun({
      startedAt: "2026-04-27T05:00:00.000Z",
      mode: "full",
      modifiedAfter: null,
      scopeKey: "category:10:assigned:78,7814"
    });
    await repository.failSyncRun({
      syncRunId: failedExpandedRunId,
      finishedAt: "2026-04-27T05:15:00.000Z",
      status: "failed"
    });

    await expect(
      repository.getLatestSuccessfulScope(["10"], ["78", "7814"])
    ).resolves.toEqual({
      scopeKey: "category:10:assigned:78",
      categoryIds: ["10"],
      assignedByIds: ["78"]
    });
    await expect(
      repository.getLatestSuccessfulScope(["10"], ["7814"])
    ).resolves.toBe(null);
  });

  it("finds a successful compatible scope when manager coverage narrows", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    const wideScopeRunId = await repository.createSyncRun({
      startedAt: "2026-04-26T21:00:00.000Z",
      mode: "delta",
      modifiedAfter: "2026-04-26T20:00:00.000Z",
      scopeKey: "category:10:assigned:72,78,7824"
    });
    await repository.finishSyncRun({
      syncRunId: wideScopeRunId,
      finishedAt: "2026-04-26T21:00:05.000Z",
      status: "success",
      leadsSynced: 0,
      dealsSynced: 0,
      modifiedAfter: "2026-04-26T20:00:00.000Z"
    });

    await expect(
      repository.getLatestSuccessfulScope(["10"], ["78"])
    ).resolves.toEqual({
      scopeKey: "category:10:assigned:72,78,7824",
      categoryIds: ["10"],
      assignedByIds: ["72", "78", "7824"]
    });
  });

  it("lists recent sync runs as an attraction-scoped durable sync journal", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    const attractionRunId = await repository.createSyncRun({
      startedAt: "2026-06-03T06:00:00.000Z",
      mode: "delta",
      modifiedAfter: "2026-06-03T05:00:00.000Z",
      scopeKey: "category:10:assigned:78"
    });
    await repository.finishSyncRun({
      syncRunId: attractionRunId,
      finishedAt: "2026-06-03T06:02:30.000Z",
      status: "success",
      leadsSynced: 0,
      dealsSynced: 12,
      dealBreakdown: {
        total: 12,
        created: 2,
        updated: 8,
        closed: 1,
        reopened: 0,
        unchanged: 1
      },
      diagnostics: ["activityBindingError=Error"],
      modifiedAfter: "2026-06-03T05:00:00.000Z"
    });

    const changedWhitelistRunId = await repository.createSyncRun({
      startedAt: "2026-06-03T06:30:00.000Z",
      mode: "delta",
      modifiedAfter: "2026-06-03T06:00:00.000Z",
      scopeKey: "category:10:assigned:72,78,7824"
    });
    await repository.finishSyncRun({
      syncRunId: changedWhitelistRunId,
      finishedAt: "2026-06-03T06:31:00.000Z",
      status: "success",
      leadsSynced: 0,
      dealsSynced: 3,
      dealBreakdown: {
        total: 3,
        created: 0,
        updated: 3,
        closed: 0,
        reopened: 0,
        unchanged: 0
      },
      diagnostics: ["scopeExpansionManagers=3"],
      modifiedAfter: "2026-06-03T06:00:00.000Z"
    });

    const leadgenRunId = await repository.createSyncRun({
      startedAt: "2026-06-03T07:00:00.000Z",
      mode: "full",
      modifiedAfter: null,
      scopeKey: "category:28:assigned:501"
    });
    await repository.failSyncRun({
      syncRunId: leadgenRunId,
      finishedAt: "2026-06-03T07:01:00.000Z",
      status: "failed",
      diagnostics: ["SYNC_FAILED", "error=API_FAIL"]
    });

    await expect(
      repository.listSyncRuns({
        limit: 5,
        scopeKey: "category:10"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: changedWhitelistRunId,
        status: "success",
        startedAt: "2026-06-03T06:30:00.000Z",
        scopeKey: "category:10:assigned:72,78,7824",
        dealsSynced: 3,
        diagnostics: ["scopeExpansionManagers=3"]
      }),
      expect.objectContaining({
        id: attractionRunId,
        status: "success",
        startedAt: "2026-06-03T06:00:00.000Z",
        finishedAt: "2026-06-03T06:02:30.000Z",
        durationMs: 150_000,
        mode: "delta",
        modifiedAfter: "2026-06-03T05:00:00.000Z",
        scopeKey: "category:10:assigned:78",
        leadsSynced: 0,
        dealsSynced: 12,
        diagnostics: ["activityBindingError=Error"],
        dealBreakdown: {
          total: 12,
          created: 2,
          updated: 8,
          closed: 1,
          reopened: 0,
          unchanged: 1
        }
      })
    ]);
  });

  it("rolls back snapshot writes when the transaction callback throws", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    expect(() =>
      repository.runSnapshotTransaction(() => {
        void repository.upsertDeals([
          {
            id: "D_ROLLBACK",
            title: null,
            leadId: null,
            categoryId: "1",
            stageId: "C1:NEW",
            stageSemanticId: "P",
            opportunity: null,
            assignedById: null,
            sourceId: "WEB",
            qualityValue: null,
            businessClubValue: null,
            targetGroupValue: null,
            meetingTypeValue: null,
            meetingDateValue: null,
            tariffValue: null,
            refusalReasonValue: null,
            refusalReasonDetail: null,
            dateCreate: "2026-04-01T00:00:00.000Z",
            dateModify: "2026-04-08T00:00:00.000Z",
            dateClosed: null,
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmContent: null,
            utmTerm: null
          }
        ]);
        void repository.setSyncCursor({
          key: "category:1:deals:date_modify",
          cursorValue: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z"
        });

        throw new Error("stage history persistence failed");
      })
    ).toThrow("stage history persistence failed");

    await expect(repository.getAllDeals()).resolves.toEqual([]);
    await expect(
      repository.getSyncCursor("category:1:deals:date_modify")
    ).resolves.toBe(null);
  });

  it("atomically replaces the authoritative current attraction deal set", async () => {
    const repository = createTempRepository();

    await expect(repository.getCurrentAttractionScope()).resolves.toEqual({
      scopeKey: null,
      reconciledAt: null,
      dealIds: []
    });

    await repository.replaceCurrentAttractionScope({
      scopeKey: "category:10:assigned:78,6994",
      dealIds: ["139938", "138542", "139938", " "],
      reconciledAt: "2026-07-27T07:00:00.000Z"
    });
    await expect(repository.getCurrentAttractionScope()).resolves.toEqual({
      scopeKey: "category:10:assigned:78,6994",
      reconciledAt: "2026-07-27T07:00:00.000Z",
      dealIds: ["138542", "139938"]
    });

    expect(() =>
      repository.runSnapshotTransaction(() => {
        void repository.replaceCurrentAttractionScope({
          scopeKey: "category:10:assigned:78",
          dealIds: ["140784"],
          reconciledAt: "2026-07-27T08:00:00.000Z"
        });
        throw new Error("rollback-current-scope");
      })
    ).toThrow("rollback-current-scope");
    await expect(repository.getCurrentAttractionScope()).resolves.toEqual({
      scopeKey: "category:10:assigned:78,6994",
      reconciledAt: "2026-07-27T07:00:00.000Z",
      dealIds: ["138542", "139938"]
    });

    await repository.replaceCurrentAttractionScope({
      scopeKey: "category:10:assigned:78",
      dealIds: ["140784"],
      reconciledAt: "2026-07-27T09:00:00.000Z"
    });
    await expect(repository.getCurrentAttractionScope()).resolves.toEqual({
      scopeKey: "category:10:assigned:78",
      reconciledAt: "2026-07-27T09:00:00.000Z",
      dealIds: ["140784"]
    });
  });

  it("initializes schema, persists won stage settings and tracks the latest sync cursor", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    expect(await repository.getWonStageIds()).toEqual(["C1:WON"]);

    await repository.replaceStageCatalog([
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:WON",
        name: "Won",
        semanticId: "S"
      }
    ]);

    await repository.upsertLeads([
      {
        id: "L1",
        statusId: "NEW",
        sourceId: "WEB",
        opportunity: 1000,
        assignedById: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-02T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await repository.upsertDeals([
        {
          id: "D1",
          title: null,
          leadId: "L1",
        categoryId: "1",
        stageId: "C1:WON",
        stageSemanticId: "S",
        opportunity: 1000,
        assignedById: null,
        sourceId: "WEB",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubOne",
        targetGroupValue: "ClubFirst",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-04-03T13:00:00.000Z",
        tariffValue: "Федеральный Москва",
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: "Связаться с Иваном по +7 900 000-00-00",
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      },
      {
        id: "D2",
        title: null,
        leadId: "L1",
        categoryId: "1",
        stageId: "C1:LOSE",
        stageSemanticId: "F",
        opportunity: 0,
        assignedById: null,
        sourceId: "WEB",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubOne",
        targetGroupValue: "ClubFirst",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-04-03T13:00:00.000Z",
        tariffValue: "Федеральный Москва",
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: "Нет бюджета на участие",
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    expect(await repository.getAllLeads()).toEqual([
      {
        id: "L1",
        statusId: "NEW",
        sourceId: "WEB",
        opportunity: 1000,
        assignedById: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-02T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    expect(await repository.getAllDeals()).toEqual([
      {
        id: "D1",
        title: null,
        contactId: null,
        leadId: "L1",
        categoryId: "1",
        stageId: "C1:WON",
        stageSemanticId: "S",
        opportunity: 1000,
        assignedById: null,
        sourceId: "WEB",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubOne",
        targetGroupValue: "ClubFirst",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-04-03T13:00:00.000Z",
        tariffValue: "Федеральный Москва",
        conversionEventValue: null,
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      },
      {
        id: "D2",
        title: null,
        contactId: null,
        leadId: "L1",
        categoryId: "1",
        stageId: "C1:LOSE",
        stageSemanticId: "F",
        opportunity: 0,
        assignedById: null,
        sourceId: "WEB",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubOne",
        targetGroupValue: "ClubFirst",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-04-03T13:00:00.000Z",
        tariffValue: "Федеральный Москва",
        conversionEventValue: null,
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: "Нет бюджета на участие",
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await repository.upsertStageHistory([
      {
        id: "H1",
        ownerId: "D1",
        categoryId: "1",
        stageId: "C1:NEW",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-04-01T00:00:00.000Z"
      }
    ]);

    await repository.upsertActivities([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "7",
        createdTime: "2026-04-08T10:00:00.000Z",
        deadline: "2026-04-09T10:00:00.000Z",
        lastUpdated: "2026-04-08T10:00:00.000Z",
        completed: false,
        completedTime: null
      },
      {
        id: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "7",
        createdTime: "2026-04-08T13:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-04-08T13:01:00.000Z",
        completed: true,
        completedTime: "2026-04-08T13:01:00.000Z"
      }
    ]);

    await repository.upsertActivityBindings([
      {
        activityId: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1"
      },
      {
        activityId: "A_CALL_NO_STAT",
        ownerTypeId: "3",
        ownerId: "C1"
      }
    ]);

    await repository.upsertActivityDeadlineChanges([
      {
        id: "A1:2026-04-08T12:00:00.000Z",
        activityId: "A1",
        ownerId: "D1",
        responsibleId: "7",
        previousDeadline: "2026-04-09T10:00:00.000Z",
        nextDeadline: "2026-04-10T10:00:00.000Z",
        changedAt: "2026-04-08T12:00:00.000Z"
      }
    ]);

    await repository.upsertCalls([
      {
        id: "CALL1",
        crmActivityId: "A1",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T10:00:00.000Z",
        callDurationSeconds: 64,
        crmEntityType: "DEAL",
        crmEntityId: "D1",
        callFailedCode: null
      },
      {
        id: "CALL2",
        crmActivityId: "A_MISSING",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T11:00:00.000Z",
        callDurationSeconds: 32,
        crmEntityType: "CONTACT",
        crmEntityId: "C1",
        callFailedCode: null
      },
      {
        id: "CALL_ZERO",
        crmActivityId: "0",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T12:00:00.000Z",
        callDurationSeconds: 12,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: null
      }
    ]);

    await repository.upsertManagerDirectory([
      {
        id: "7",
        name: "Анна Куратор"
      }
    ]);

    expect(await repository.getLatestSuccessCursor()).toBe("2026-04-08T00:00:00.000Z");
    expect(await repository.getOperationalHistoryBootstrappedAt()).toBe(null);
    expect(await repository.getDealCustomFieldsBootstrappedAt()).toBe(null);
    expect(await repository.getDealMeetingDateFieldBootstrappedAt()).toBe(null);
    expect((await repository.getStageCatalog())[0]?.name).toBe("Won");
    expect(await repository.getDealIdsByCategoryIds(["1"])).toEqual(["D1", "D2"]);
    expect(await repository.getDealIdsByCategoryIds(["1"], ["78"])).toEqual([]);
    expect(await repository.getActivitiesByIds(["A1"])).toEqual([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "7",
        createdTime: "2026-04-08T10:00:00.000Z",
        deadline: "2026-04-09T10:00:00.000Z",
        lastUpdated: "2026-04-08T10:00:00.000Z",
        completed: false,
        completedTime: null
      }
    ]);
    expect(await repository.getCallActivityIdsMissingActivities()).toEqual([
      "A_MISSING"
    ]);
    expect(
      await repository.getCallActivityIdsMissingCallStats(
        100,
        "2026-04-01T00:00:00.000Z"
      )
    ).toEqual(["A_CALL_NO_STAT"]);
    expect(
      await repository.getCallActivityIdsForCallStatsRefresh(
        100,
        "2026-04-01T00:00:00.000Z"
      )
    ).toEqual(["A_CALL_NO_STAT"]);
    expect(await repository.getAllStageHistory()).toEqual([
      {
        id: "H1",
        ownerId: "D1",
        categoryId: "1",
        stageId: "C1:NEW",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-04-01T00:00:00.000Z"
      }
    ]);
    expect(await repository.getAllActivities()).toEqual([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "7",
        createdTime: "2026-04-08T10:00:00.000Z",
        deadline: "2026-04-09T10:00:00.000Z",
        lastUpdated: "2026-04-08T10:00:00.000Z",
        completed: false,
        completedTime: null
      },
      {
        id: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "7",
        createdTime: "2026-04-08T13:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-04-08T13:01:00.000Z",
        completed: true,
        completedTime: "2026-04-08T13:01:00.000Z"
      }
    ]);
    expect(await repository.getAllActivityBindings()).toEqual([
      {
        activityId: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1"
      },
      {
        activityId: "A_CALL_NO_STAT",
        ownerTypeId: "3",
        ownerId: "C1"
      }
    ]);
    expect(
      await repository.getActivityBindingsByActivityIds(["A_CALL_NO_STAT"])
    ).toEqual([
      {
        activityId: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1"
      },
      {
        activityId: "A_CALL_NO_STAT",
        ownerTypeId: "3",
        ownerId: "C1"
      }
    ]);
    expect(await repository.getAllActivityDeadlineChanges()).toEqual([
      {
        id: "A1:2026-04-08T12:00:00.000Z",
        activityId: "A1",
        ownerId: "D1",
        responsibleId: "7",
        previousDeadline: "2026-04-09T10:00:00.000Z",
        nextDeadline: "2026-04-10T10:00:00.000Z",
        changedAt: "2026-04-08T12:00:00.000Z"
      }
    ]);
    expect(await repository.getAllCalls()).toEqual([
      {
        id: "CALL1",
        crmActivityId: "A1",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T10:00:00.000Z",
        callDurationSeconds: 64,
        crmEntityType: "DEAL",
        crmEntityId: "D1",
        callFailedCode: null
      },
      {
        id: "CALL2",
        crmActivityId: "A_MISSING",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T11:00:00.000Z",
        callDurationSeconds: 32,
        crmEntityType: "CONTACT",
        crmEntityId: "C1",
        callFailedCode: null
      },
      {
        id: "CALL_ZERO",
        crmActivityId: "0",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T12:00:00.000Z",
        callDurationSeconds: 12,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: null
      }
    ]);
    await expect(repository.getSnapshotStats()).resolves.toEqual({
      deals: 2,
      activities: 2,
      calls: 3,
      stageHistory: 1
    });
    await expect(
      repository.getSnapshotStats({
        categoryIds: ["1"],
        assignedByIds: ["78"]
      })
    ).resolves.toEqual({
      deals: 0,
      activities: 0,
      calls: 0,
      stageHistory: 0
    });
    expect(await repository.getManagerDirectory()).toEqual([
      {
        id: "7",
        name: "Анна Куратор"
      }
    ]);

    await repository.setWonStageIds(["C1:PAID"]);
    expect(await repository.getWonStageIds()).toEqual(["C1:PAID"]);

    await repository.markOperationalHistoryBootstrapped("2026-04-13T09:00:00.000Z");
    expect(await repository.getOperationalHistoryBootstrappedAt()).toBe(
      "2026-04-13T09:00:00.000Z"
    );
    await repository.markDealCustomFieldsBootstrapped("2026-04-13T10:00:00.000Z");
    expect(await repository.getDealCustomFieldsBootstrappedAt()).toBe(
      "2026-04-13T10:00:00.000Z"
    );
    await repository.markDealMeetingDateFieldBootstrapped("2026-04-13T11:00:00.000Z");
    expect(await repository.getDealMeetingDateFieldBootstrappedAt()).toBe(
      "2026-04-13T11:00:00.000Z"
    );

    await repository.setSyncCursor({
      key: "category:10:activities:last_updated",
      cursorValue: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:01:00.000Z"
    });
    expect(
      await repository.getSyncCursor("category:10:activities:last_updated")
    ).toBe("2026-04-25T10:00:00.000Z");

    await repository.upsertSyncCoverage({
      scopeKey: "category:10",
      stream: "activity_history",
      providerId: "CRM_TODO",
      coveredFrom: "2026-01-25T00:00:00.000Z",
      coveredTo: null,
      algorithmVersion: "activity-bindings-v2",
      syncedAt: "2026-04-25T10:00:00.000Z"
    });
    await expect(
      repository.hasSyncCoverage({
        scopeKey: "category:10",
        stream: "activity_history",
        providerId: "CRM_TODO",
        requiredFrom: "2025-04-25T00:00:00.000Z",
        algorithmVersion: "activity-bindings-v2"
      })
    ).resolves.toBe(false);
    await expect(
      repository.hasSyncCoverage({
        scopeKey: "category:10",
        stream: "activity_history",
        providerId: "CRM_TODO",
        requiredFrom: "2026-02-01T00:00:00.000Z",
        requiredSyncedAt: "2026-04-25T10:01:00.000Z",
        algorithmVersion: "activity-bindings-v2"
      })
    ).resolves.toBe(false);
    await expect(
      repository.hasSyncCoverage({
        scopeKey: "category:10",
        stream: "activity_history",
        providerId: "CRM_TODO",
        requiredFrom: "2026-02-01T00:00:00.000Z",
        requiredSyncedAt: "2026-04-25T09:59:00.000Z",
        algorithmVersion: "activity-bindings-v2"
      })
    ).resolves.toBe(true);
  });
});
