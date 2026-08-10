import type { DealAnalysisTimelineItem } from "@bitrix24-reporting/contracts";

const SAFE_TIMELINE_TITLES: Record<DealAnalysisTimelineItem["kind"], string> = {
  call: "Звонок",
  task_created: "Задача",
  task_completed: "Задача",
  meeting: "Встреча",
  meeting_date_changed: "Дата встречи изменена",
  conversion_event_visit: "Мероприятие",
  message: "Сообщение"
};

export function projectDealAnalysisTimeline(input: {
  timeline: DealAnalysisTimelineItem[];
  includeSensitiveContent: boolean;
}): DealAnalysisTimelineItem[] {
  if (input.includeSensitiveContent) return input.timeline;

  return input.timeline
    .filter((item) => item.kind !== "message")
    .map((item) => ({
      ...item,
      title: SAFE_TIMELINE_TITLES[item.kind],
      comment: null
    }));
}
