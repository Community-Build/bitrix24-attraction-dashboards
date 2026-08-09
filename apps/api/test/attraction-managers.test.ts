import { describe, expect, it } from "vitest";

import {
  ATTRACTION_MANAGER_CATALOG,
  buildManagerTeams,
  normalizeAttractionManagerFilters,
  resolveAttractionManagerAccessScope
} from "../src/domain/attraction-managers";

describe("attraction manager whitelist", () => {
  it("includes Kakuliya Ilya in the attraction scope", () => {
    expect(ATTRACTION_MANAGER_CATALOG).toContainEqual({
      id: "13020",
      name: "Какулия Илья"
    });

    expect(normalizeAttractionManagerFilters(undefined).managerIds).toContain(
      "13020"
    );
    expect(
      normalizeAttractionManagerFilters({ managerIds: ["13020"] }).managerIds
    ).toEqual(["13020"]);
  });

  it("shows all calls for community managers without widening deal attribution", () => {
    expect(ATTRACTION_MANAGER_CATALOG).toEqual(
      expect.arrayContaining([
        {
          id: "7538",
          name: "Мария Саличева",
          callAttributionPolicy: "direct_only",
          callDisplayPolicy: "all_calls"
        },
        {
          id: "118",
          name: "Аделия Космасова",
          callAttributionPolicy: "direct_only",
          callDisplayPolicy: "all_calls"
        }
      ])
    );

    expect(normalizeAttractionManagerFilters(undefined).managerIds).toEqual(
      expect.arrayContaining(["7538", "118"])
    );
  });

  it("scopes employee report filters to the employee manager team", () => {
    const settings = [
      {
        moduleKey: "attraction",
        managerId: "78",
        managerName: "Егоров Андрей",
        enabled: true,
        sortOrder: 0,
        updatedAt: "2026-06-17T00:00:00.000Z",
        teamId: "attraction",
        teamName: "Привлечение"
      },
      {
        moduleKey: "attraction",
        managerId: "13020",
        managerName: "Какулия Илья",
        enabled: true,
        sortOrder: 10,
        updatedAt: "2026-06-17T00:00:00.000Z",
        teamId: "attraction",
        teamName: "Привлечение"
      },
      {
        moduleKey: "attraction",
        managerId: "11234",
        managerName: "Ромашова Ольга",
        enabled: true,
        sortOrder: 20,
        updatedAt: "2026-06-17T00:00:00.000Z",
        teamId: "attraction-stroke",
        teamName: "Привлечение штрих"
      }
    ];

    expect(
      resolveAttractionManagerAccessScope({
        settings,
        defaultManagerId: "78",
        canSeeAllTeams: false
      })
    ).toEqual(["78", "13020"]);

    expect(
      resolveAttractionManagerAccessScope({
        settings,
        defaultManagerId: "78",
        canSeeAllTeams: true
      })
    ).toEqual(["78", "13020", "11234"]);
  });

  it("builds ordered team settings from manager whitelist rows", () => {
    expect(
      buildManagerTeams([
        {
          moduleKey: "attraction",
          managerId: "78",
          managerName: "Егоров Андрей",
          enabled: true,
          sortOrder: 20,
          updatedAt: "2026-06-17T00:00:00.000Z",
          teamId: "attraction",
          teamName: "Привлечение"
        },
        {
          moduleKey: "attraction",
          managerId: "13020",
          managerName: "Какулия Илья",
          enabled: true,
          sortOrder: 10,
          updatedAt: "2026-06-17T00:00:00.000Z",
          teamId: "attraction",
          teamName: "Привлечение"
        },
        {
          moduleKey: "attraction",
          managerId: "11234",
          managerName: "Ромашова Ольга",
          enabled: true,
          sortOrder: 30,
          updatedAt: "2026-06-17T00:00:00.000Z",
          teamId: "attraction-stroke",
          teamName: "Привлечение штрих"
        }
      ])
    ).toEqual([
      {
        id: "attraction",
        name: "Привлечение",
        managerIds: ["13020", "78"],
        sortOrder: 10,
        updatedAt: "2026-06-17T00:00:00.000Z"
      },
      {
        id: "attraction-stroke",
        name: "Привлечение штрих",
        managerIds: ["11234"],
        sortOrder: 30,
        updatedAt: "2026-06-17T00:00:00.000Z"
      }
    ]);
  });
});
