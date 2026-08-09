import { describe, expect, it } from "vitest";

import {
  sanitizeActivityDescription,
  sanitizeActivitySubject
} from "../src/domain/activity-content";

describe("activity content sanitization", () => {
  it("keeps readable text while removing markup and executable blocks", () => {
    expect(sanitizeActivitySubject("<b>Позвонить</b>&nbsp;клиенту")).toBe(
      "Позвонить клиенту"
    );
    expect(
      sanitizeActivityDescription(
        "<p>Обсудить условия</p><script>secret()</script><br>Зафиксировать следующий шаг"
      )
    ).toBe("Обсудить условия\nЗафиксировать следующий шаг");
  });
});
