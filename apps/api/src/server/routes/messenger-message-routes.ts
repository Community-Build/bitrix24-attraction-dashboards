import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export function registerMessengerMessageRoutes(
  app: express.Express,
  handlers: {
    collect: ApiRouteHandler;
    summary: ApiRouteHandler;
    read: ApiRouteHandler;
  }
) {
  app.post("/api/messenger-messages/collect", handlers.collect);
  app.post("/api/messenger-messages/summary", handlers.summary);
  app.post("/api/messenger-messages/read", handlers.read);
}
