import type { Request, Response } from "express";
import { HttpError } from "../errors/http-error";
import type { CountSubmissionBody } from "../validation/schemas";
import { StaService } from "../services/sta-service";

function toOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  throw new HttpError(400, `${fieldName} must be a string`);
}

function normalizePersonName(value: string): string {
  return value.trim().toLowerCase();
}

export class WarehouseController {
  constructor(private readonly service: StaService) {}

  listBins = async (_request: Request, response: Response) => {
    const bins = await this.service.listBins();
    response.json(bins);
  };

  listWhCodes = async (request: Request, response: Response) => {
    const sessionId = toOptionalString(request.query.sessionId, "sessionId");
    const codes = await this.service.listWhCodes(sessionId);
    response.json(codes);
  };

  searchItems = async (request: Request, response: Response) => {
    const query = toOptionalString(request.query.query, "query") ?? "";
    const sessionId = toOptionalString(request.query.sessionId, "sessionId");
    const rows = await this.service.searchWarehouseItems(query, sessionId ?? undefined);
    response.json(rows);
  };

  listAssignedItems = async (request: Request, response: Response) => {
    const assignee = toOptionalString(request.query.assignee, "assignee");
    let userName = toOptionalString(request.query.userName, "userName");
    const sessionId = toOptionalString(request.query.sessionId, "sessionId");

    if (!userName) {
      const authEmail = request.authUser?.email?.trim().toLowerCase();
      if (authEmail) {
        const directoryUser = await this.service.findUserByEmail(authEmail);
        if (directoryUser?.name && directoryUser.accountEnabled !== false) {
          userName = directoryUser.name;
        }
      }
    }

    const rows = await this.service.listAssignedItems({ assignee, userName });
    const filtered = sessionId ? rows.filter((row) => row.sessionId === sessionId) : rows;
    response.json(filtered);
  };

  submitCount = async (request: Request, response: Response) => {
    const body = request.body as CountSubmissionBody;
    const authEmail = request.authUser?.email?.trim().toLowerCase();
    const authRole = request.authUser?.role ?? "User";
    const authDirectoryUser = authEmail ? await this.service.findUserByEmail(authEmail) : null;
    if (authEmail && (!authDirectoryUser || authDirectoryUser.accountEnabled === false)) {
      throw new HttpError(403, "User is not allowed to submit counts");
    }

    const canonicalSubmitterName = authDirectoryUser?.name?.trim() || body.submittedBy.trim();
    if (!canonicalSubmitterName) {
      throw new HttpError(400, "submittedBy is required");
    }

    const item = await this.service.getItemById(body.itemId);
    if (!item) {
      throw new HttpError(404, "Item not found");
    }

    const sessionId = item.sessionId;
    if (sessionId) {
      const session = await this.service.getSession(sessionId);
      if (session.strictRoles && authRole === "User" && item.assignedPair) {
        const targetPair = (await this.service.listPairs(sessionId)).find((pair) => pair.id === item.assignedPair);
        if (targetPair) {
          const actor = normalizePersonName(canonicalSubmitterName);
          const checker = normalizePersonName(targetPair.checker);
          const counters = [targetPair.counter, targetPair.counter2]
            .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
            .map((name) => normalizePersonName(name));

          if (!counters.includes(actor)) {
            if (actor === checker) {
              throw new HttpError(403, "Strict role mode: checker cannot submit counts. Assigned counter must submit.");
            }
            throw new HttpError(403, "Strict role mode: only assigned counter can submit counts for this item.");
          }
        }
      }
    }

    const result = await this.service.submitCount({
      ...body,
      submittedBy: canonicalSubmitterName
    });
    response.status(201).json(result);
  };
}
