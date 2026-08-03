import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export function registerMessengerMessageRoutes(
  app: express.Express,
  handlers: {
    collect: ApiRouteHandler;
  }
) {
  app.post("/api/messenger-messages/collect", handlers.collect);
}
