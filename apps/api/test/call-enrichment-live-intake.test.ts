import { describe, expect, it, vi } from "vitest";

import { createCallEnrichmentLiveIntakeQueue } from "../src/server/call-enrichment-live-intake";

describe("createCallEnrichmentLiveIntakeQueue", () => {
  it("hydrates a native Bitrix call event from live Bitrix before queueing analysis", async () => {
    const client = {
      listCalls: vi.fn().mockResolvedValue([
        {
          ID: "228610",
          CALL_ID: "externalCall.abc",
          CRM_ACTIVITY_ID: "525646",
          PORTAL_USER_ID: "13020",
          CALL_TYPE: "1",
          CALL_START_DATE: "2026-07-02T15:48:32+03:00",
          CALL_DURATION: "58",
          CRM_ENTITY_TYPE: "CONTACT",
          CRM_ENTITY_ID: "38926",
          CALL_FAILED_CODE: "200"
        }
      ]),
      listActivitiesByIds: vi.fn().mockResolvedValue([
        {
          ID: "525646",
          OWNER_TYPE_ID: "2",
          OWNER_ID: "158724",
          TYPE_ID: "2",
          PROVIDER_ID: "VOXIMPLANT_CALL",
          RESPONSIBLE_ID: "13020",
          CREATED: "2026-07-02T15:48:32+03:00",
          DEADLINE: null,
          LAST_UPDATED: "2026-07-02T15:49:37+03:00",
          COMPLETED: "Y",
          COMPLETED_DATE: "2026-07-02T15:49:37+03:00"
        }
      ]),
      listActivityBindings: vi.fn().mockResolvedValue([
        {
          activityId: "525646",
          ownerTypeId: "2",
          ownerId: "158724"
        },
        {
          activityId: "525646",
          ownerTypeId: "3",
          ownerId: "38926"
        }
      ])
    };
    const repository = {
      upsertCalls: vi.fn().mockResolvedValue(1),
      upsertActivities: vi.fn().mockResolvedValue(1),
      upsertActivityBindings: vi.fn().mockResolvedValue(2)
    };
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "228610"
    });
    const queue = createCallEnrichmentLiveIntakeQueue({
      client,
      repository,
      queueAutomaticCallAnalysis
    });

    await expect(
      queue.queueAutomaticCallAnalysis({
        callId: "externalCall.abc",
        activityId: "525646",
        dealId: null,
        contactId: null,
        managerId: "13020",
        durationSeconds: 58,
        occurredAt: "2026-07-02T15:48:32+03:00"
      })
    ).resolves.toEqual({
      status: "queued",
      callId: "228610"
    });

    expect(client.listCalls).toHaveBeenCalledWith({ activityIds: ["525646"] });
    expect(repository.upsertCalls).toHaveBeenCalledWith([
      {
        id: "228610",
        crmActivityId: "525646",
        portalUserId: "13020",
        callType: "1",
        callStartDate: "2026-07-02T15:48:32+03:00",
        callDurationSeconds: 58,
        crmEntityType: "CONTACT",
        crmEntityId: "38926",
        callFailedCode: "200"
      }
    ]);
    expect(repository.upsertActivities).toHaveBeenCalledWith([
      {
        id: "525646",
        ownerTypeId: "2",
        ownerId: "158724",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "13020",
        createdTime: "2026-07-02T15:48:32+03:00",
        deadline: null,
        lastUpdated: "2026-07-02T15:49:37+03:00",
        completed: true,
        completedTime: "2026-07-02T15:49:37+03:00"
      }
    ]);
    expect(repository.upsertActivityBindings).toHaveBeenCalledWith([
      {
        activityId: "525646",
        ownerTypeId: "2",
        ownerId: "158724"
      },
      {
        activityId: "525646",
        ownerTypeId: "3",
        ownerId: "38926"
      }
    ]);
    expect(queueAutomaticCallAnalysis).toHaveBeenCalledWith({
      callId: "228610",
      activityId: "525646",
      dealId: null,
      contactId: null,
      managerId: "13020",
      durationSeconds: 58,
      occurredAt: "2026-07-02T15:48:32+03:00"
    });
  });
});
