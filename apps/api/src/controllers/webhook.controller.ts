import type { Request, Response } from "express";
import type { WebhookImportBinsBody, WebhookImportItemsBody, WebhookImportUsersBody } from "../validation/schemas";
import { StaService } from "../services/sta-service";

export class WebhookController {
  constructor(private readonly service: StaService) {}

  importBins = async (request: Request<object, object, WebhookImportBinsBody>, response: Response) => {
    const result = await this.service.importWebhookPayload({
      source: "bins",
      data: request.body.data
    });
    response.status(201).json(result);
  };

  importUsers = async (request: Request<object, object, WebhookImportUsersBody>, response: Response) => {
    const result = await this.service.importWebhookPayload({
      source: "users",
      data: request.body.data
    });
    response.status(201).json(result);
  };

  importItems = async (request: Request<object, object, WebhookImportItemsBody>, response: Response) => {
    const result = await this.service.importWebhookPayload({
      source: "items",
      sessionId: request.body.sessionId,
      entity: request.body.entity,
      data: request.body.data
    });
    response.status(201).json(result);
  };
}
