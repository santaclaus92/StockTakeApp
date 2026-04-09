import type { Request, Response } from "express";
import { HttpError } from "../errors/http-error";
import { StaService } from "../services/sta-service";
import type { AuthMetadataSync } from "./auth.controller";
import type {
  BulkAssignBody,
  AttendanceScanBody,
  AttendanceUpsertBody,
  AuditInsertBody,
  CreateAdjustmentBody,
  CreatePairBody,
  CreateSessionBody,
  ImportFromPaBody,
  ImportFromSapBody,
  ImportUsersFromPaBody,
  ItemUpdateBody,
  ItemCountUpdateBody,
  NewItemCreateBody,
  NewItemUpdateBody,
  SessionDeleteBody,
  UpdateSessionBody,
  UserRoleUpdateBody,
  UpdatePairBody
} from "../validation/schemas";

function toSingleString(value: unknown, fieldName: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  throw new HttpError(400, `${fieldName} must be a string`);
}

function normalizePersonName(value: string): string {
  return value.trim().toLowerCase();
}

function parseImportRows(payload: unknown): Record<string, unknown>[] {
  console.log("[parseImportRows] type:", typeof payload, "| isArray:", Array.isArray(payload), "| keys:", payload && typeof payload === "object" ? Object.keys(payload as object).join(",") : "n/a", "| raw:", JSON.stringify(payload)?.slice(0, 300));
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.body, record.value, record.items, record.data, record.rows, record.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as Record<string, unknown>[];
    }
  }

  return [];
}

function parseOptionalNonNegativeInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function parseNextOffset(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.nextOffset, record.next_offset, record.nextSkip, record.next_skip];
  for (const candidate of candidates) {
    const parsed = parseOptionalNonNegativeInt(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseHasMore(payload: unknown): boolean | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.hasMore, record.has_more, record.more];
  for (const candidate of candidates) {
    const parsed = parseOptionalBoolean(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function dedupeImportRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const stableId = String(row.ItemInternalId ?? row.id ?? "").trim();
    const code = String(row.item_code ?? row.code ?? "").trim();
    const location = String(
      row.item_location ?? row.itemLocation ?? row.bin_location ?? row.binLocation ?? row.warehouse ?? row.location ?? ""
    ).trim();
    const warehouseCode = String(row.wh_code ?? row.whCode ?? row.warehouse_code ?? row.warehouseCode ?? row.wh ?? "").trim();
    const batch = String(row.batch_serial_num ?? row.batch ?? "").trim();
    const key = stableId
      ? `id:${stableId}`
      : code || location || warehouseCode || batch
      ? `cmp:${code}|${location}|${warehouseCode}|${batch}`
      : `row:${index}`;

    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(row);
  });

  return unique;
}

function buildApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const apiKey = process.env.API_KEY ?? process.env.PA_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers.apikey = apiKey;
  }

  const supabaseKey = process.env.SUPABASE_EDGE_FUNCTION_KEY;
  if (supabaseKey) {
    headers["Authorization"] = `Bearer ${supabaseKey}`;
    if (!headers.apikey) {
      headers.apikey = supabaseKey;
    }
  }

  return headers;
}

async function fetchUpstreamImportRows(
  upstreamUrl: string,
  body: Record<string, unknown>,
  sourceLabel: string
): Promise<unknown> {
  console.log(`[fetchUpstream:${sourceLabel}] POST ${upstreamUrl} body:`, JSON.stringify(body));
  // PA URLs use SAS auth (sig= in query string) — only send Content-Type, no Authorization header
  const isPowerAutomateUrl = upstreamUrl.includes("powerplatform.com") || upstreamUrl.includes("logic.azure.com");
  const headers = isPowerAutomateUrl ? { "Content-Type": "application/json" } : buildApiHeaders();
  const upstreamResponse = await fetch(upstreamUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  console.log(`[fetchUpstream:${sourceLabel}] status:`, upstreamResponse.status);
  if (!upstreamResponse.ok) {
    const failureBody = await upstreamResponse.text();
    console.log(`[fetchUpstream:${sourceLabel}] error body:`, failureBody.slice(0, 300));
    throw new HttpError(
      502,
      `${sourceLabel} upstream import failed (${upstreamResponse.status})${failureBody ? `: ${failureBody.slice(0, 200)}` : ""}`
    );
  }

  const text = await upstreamResponse.text();
  console.log(`[fetchUpstream:${sourceLabel}] raw response:`, text.slice(0, 300));
  return JSON.parse(text) as unknown;
}

interface PagedImportFetchOptions {
  upstreamUrl: string;
  sourceLabel: string;
  baseBody: Record<string, unknown>;
  pageSize: number;
  maxPages: number;
}

async function fetchPagedImportRows(options: PagedImportFetchOptions): Promise<{ rows: Record<string, unknown>[]; pagesFetched: number }> {
  let pagesFetched = 0;
  let offset = 0;
  let page = 1;
  const collected: Record<string, unknown>[] = [];
  let lastPageRowCount = 0;
  let lastHasMore: boolean | null = null;

  while (pagesFetched < options.maxPages) {
    const payload = await fetchUpstreamImportRows(
      options.upstreamUrl,
      {
        ...options.baseBody,
        limit: options.pageSize,
        offset,
        page
      },
      options.sourceLabel
    );

    const pageRows = parseImportRows(payload);
    const hasMore = parseHasMore(payload);
    const nextOffset = parseNextOffset(payload);
    lastHasMore = hasMore;

    pagesFetched += 1;
    lastPageRowCount = pageRows.length;

    if (pageRows.length === 0) {
      break;
    }

    collected.push(...pageRows);

    const explicitHasMore = hasMore === true;
    const explicitNoMore = hasMore === false;
    const explicitNextOffset = nextOffset !== null && nextOffset > offset;

    if (explicitNoMore) {
      break;
    }

    if (!explicitHasMore && !explicitNextOffset && pageRows.length < options.pageSize) {
      break;
    }

    const next = explicitNextOffset ? nextOffset : offset + pageRows.length;
    if (next <= offset) {
      break;
    }

    offset = next;
    page += 1;
  }

  if (pagesFetched >= options.maxPages && (lastHasMore === true || lastPageRowCount >= options.pageSize)) {
    throw new HttpError(
      502,
      `${options.sourceLabel} upstream import reached max page limit (${options.maxPages}). Increase related PAGE limit env settings if needed.`
    );
  }

  return {
    rows: collected,
    pagesFetched
  };
}

export class AdminController {
  constructor(
    public readonly service: StaService,
    private readonly metadataSync?: AuthMetadataSync
  ) {}

  listSessions = async (request: Request, response: Response) => {
    const data = await this.service.listSessions();
    const role = request.authUser?.role ?? "User";

    if (role === "User") {
      response.json(data.filter((session) => session.status === "Active" && session.userVisible));
      return;
    }

    response.json(data);
  };

  createSession = async (request: Request, response: Response) => {
    const body = request.body as CreateSessionBody;
    const session = await this.service.createSession(body);
    response.status(201).json(session);
  };

  updateSession = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const body = request.body as UpdateSessionBody;
    const session = await this.service.updateSession(sessionId, body);
    response.json(session);
  };

  reopenSession = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const session = await this.service.reopenSession(sessionId);
    response.json(session);
  };

  endSession = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const session = await this.service.endSession(sessionId);
    response.json(session);
  };

  loadRecountItems = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const result = await this.service.loadRecountItems(sessionId);
    response.json(result);
  };

  toggleSessionVisibility = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const session = await this.service.toggleSessionVisibility(sessionId);
    response.json(session);
  };

  toggleStrictRoles = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const session = await this.service.toggleStrictRoles(sessionId);
    response.json(session);
  };

  deleteSession = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const body = (request.body ?? {}) as SessionDeleteBody;
    const deletedBy = body.deletedBy?.trim() || request.authUser?.email || request.authUser?.id || "admin";
    const result = await this.service.deleteSession(sessionId, deletedBy);
    response.json(result);
  };

  getSession = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const session = await this.service.getSession(sessionId);
    response.json(session);
  };

  listPairs = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const rows = await this.service.listPairs(sessionId);
    response.json(rows);
  };

  createPair = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const body = request.body as CreatePairBody;
    const row = await this.service.createPair(sessionId, body);
    response.status(201).json(row);
  };

  updatePair = async (request: Request, response: Response) => {
    const pairId = toSingleString(request.params.id, "id");
    const body = request.body as UpdatePairBody;
    const row = await this.service.updatePair(pairId, {
      id: pairId,
      ...body
    });
    response.json(row);
  };

  deletePair = async (request: Request, response: Response) => {
    const pairId = toSingleString(request.params.id, "id");
    const result = await this.service.deletePair(pairId);
    response.json(result);
  };

  listAttendance = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const rows = await this.service.listAttendance(sessionId);
    response.json(rows);
  };

  upsertAttendance = async (request: Request, response: Response) => {
    const body = request.body as AttendanceUpsertBody;
    const row = await this.service.upsertAttendance(body);
    response.status(201).json(row);
  };

  scanAttendance = async (request: Request, response: Response) => {
    const body = request.body as AttendanceScanBody;
    const row = await this.service.scanAttendance(body);
    response.status(201).json(row);
  };

  toggleAttendance = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const userId = toSingleString(request.params.userId, "userId");
    const row = await this.service.toggleAttendance(sessionId, userId);
    response.json(row);
  };

  listItems = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const rows = await this.service.listItems(sessionId);
    response.json(rows);
  };

  updateItemCount = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const itemId = toSingleString(request.params.itemId, "itemId");
    const body = request.body as ItemCountUpdateBody;
    const row = await this.service.updateItemCount({
      sessionId,
      itemId,
      countQty: body.countQty
    });
    response.json(row);
  };

  updateItem = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const itemId = toSingleString(request.params.itemId, "itemId");
    const body = request.body as ItemUpdateBody;
    const row = await this.service.updateItem({
      sessionId,
      itemId,
      countQty: body.countQty,
      damagedQty: body.damagedQty,
      expiredQty: body.expiredQty,
      dropped: body.dropped,
      assignedPair: body.assignedPair ?? undefined,
      assignedTo: body.assignedTo ?? undefined,
      adminRemark: body.adminRemark ?? undefined
    });
    response.json(row);
  };

  bulkAssignItems = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const body = request.body as BulkAssignBody;
    const result = await this.service.bulkAssignItems({
      sessionId,
      itemIds: body.itemIds,
      pairId: body.pairId,
      assignedTo: body.assignedTo ?? undefined
    });
    response.json(result);
  };

  importBinsFromPa = async (request: Request<object, object, ImportFromPaBody>, response: Response) => {
    const body = request.body ?? {};
    let data = body.data ?? [];
    let pagesFetched = 0;

    if (data.length === 0) {
      const upstreamUrl = process.env.PA_BINS_URL;
      if (!upstreamUrl) {
        throw new HttpError(503, "PA_BINS_URL is not configured and no import payload was provided");
      }

      const pageSize = Math.max(1, parseOptionalNonNegativeInt(process.env.PA_BINS_PAGE_SIZE) ?? 10000);
      const maxPages = Math.max(1, parseOptionalNonNegativeInt(process.env.PA_BINS_MAX_PAGES) ?? 1);
      const fetched = await fetchPagedImportRows({
        upstreamUrl,
        sourceLabel: "Bins",
        baseBody: {},
        pageSize,
        maxPages
      });
      data = fetched.rows;
      pagesFetched = fetched.pagesFetched;
    }

    const result = await this.service.importWebhookPayload({
      source: "bins",
      data
    });

    response.status(201).json({ ...result, received: data.length, pagesFetched });
  };

  importUsersFromPa = async (request: Request<object, object, ImportUsersFromPaBody>, response: Response) => {
    const body = request.body ?? {};
    let data = body.data ?? [];
    let pagesFetched = 0;
    if (body.resetSessionAssignments && !body.sessionId) {
      throw new HttpError(400, "sessionId is required when resetSessionAssignments is true");
    }

    if (data.length === 0) {
      const upstreamUrl = process.env.PA_USERS_URL;
      if (!upstreamUrl) {
        throw new HttpError(503, "PA_USERS_URL is not configured and no import payload was provided");
      }

      const pageSize = Math.max(1, parseOptionalNonNegativeInt(process.env.PA_USERS_PAGE_SIZE) ?? 10000);
      const maxPages = Math.max(1, parseOptionalNonNegativeInt(process.env.PA_USERS_MAX_PAGES) ?? 1);
      const fetched = await fetchPagedImportRows({
        upstreamUrl,
        sourceLabel: "Users",
        baseBody: { sessionId: body.sessionId },
        pageSize,
        maxPages
      });
      data = fetched.rows;
      pagesFetched = fetched.pagesFetched;
    }

    const result = await this.service.importWebhookPayload({
      source: "users",
      data
    });

    const shouldResetAssignments = Boolean(body.resetSessionAssignments && body.sessionId);
    const resetResult = shouldResetAssignments ? await this.service.resetSessionAssignments(String(body.sessionId)) : undefined;

    response.status(201).json({ ...result, received: data.length, pagesFetched, reset: resetResult });
  };

  importItemsFromSap = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const body = request.body as ImportFromSapBody;
    let data = body.data ?? [];
    let pagesFetched = 0;

    if (data.length === 0) {
      const upstreamUrl = process.env.PA_ITEMS_URL;
      if (!upstreamUrl) {
        throw new HttpError(503, "PA_ITEMS_URL is not configured and no import payload was provided");
      }

      const pageSize = Math.max(1, body.limit ?? parseOptionalNonNegativeInt(process.env.PA_ITEMS_PAGE_SIZE) ?? 10000);
      const maxPages = Math.max(1, body.maxPages ?? parseOptionalNonNegativeInt(process.env.PA_ITEMS_MAX_PAGES) ?? 1);

      const fetched = await fetchPagedImportRows({
        upstreamUrl,
        sourceLabel: "SAP",
        baseBody: {
          sessionId,
          entity: body.entity
        },
        pageSize,
        maxPages
      });

      data = fetched.rows;
      pagesFetched = fetched.pagesFetched;
    }

    const received = data.length;
    const dedupedData = dedupeImportRows(data);
    const result = await this.service.importWebhookPayload({
      source: "items",
      sessionId,
      entity: body.entity,
      data: dedupedData
    });
    response.status(201).json({ ...result, received, deduped: dedupedData.length, pagesFetched });
  };

  listAllItems = async (request: Request, response: Response) => {
    const querySessionId = request.query.sessionId;
    if (!querySessionId) {
      response.status(400).json({ message: "sessionId query is required" });
      return;
    }
    const sessionId = toSingleString(querySessionId, "sessionId");
    const rows = await this.service.listItems(sessionId);
    response.json(rows);
  };

  getDashboard = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const row = await this.service.getDashboard(sessionId);
    response.json(row);
  };

  getDashboardDetails = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const row = await this.service.getDashboardDetails(sessionId);
    response.json(row);
  };

  listAudit = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const rows = await this.service.listAudit(sessionId);
    response.json(rows);
  };

  createAudit = async (request: Request, response: Response) => {
    const body = request.body as AuditInsertBody;
    const row = await this.service.createAuditEntry(body);
    response.status(201).json(row);
  };

  listNewItems = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const rows = await this.service.listNewItems(sessionId);
    response.json(rows);
  };

  createNewItem = async (request: Request, response: Response) => {
    const body = request.body as NewItemCreateBody;
    const row = await this.service.createNewItem(body);
    response.status(201).json(row);
  };

  updateNewItem = async (request: Request, response: Response) => {
    const itemId = toSingleString(request.params.id, "id");
    const body = request.body as NewItemUpdateBody;
    const row = await this.service.updateNewItemStatus(itemId, body.status);
    response.json(row);
  };

  listApprovals = async (request: Request, response: Response) => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const rows = await this.service.listApprovals(sessionId);
    response.json(rows);
  };

  private reviewApproval = async (request: Request, response: Response, action: "Approved" | "Rejected") => {
    const sessionId = toSingleString(request.params.sessionId, "sessionId");
    const approvalId = toSingleString(request.params.approvalId, "approvalId");
    const body = request.body as { reviewedBy?: string };
    const reviewer = body.reviewedBy?.trim() || request.authUser?.email || request.authUser?.id || "admin";
    const row = await this.service.reviewApproval({
      sessionId,
      approvalId,
      action,
      reviewedBy: reviewer
    });
    response.json(row);
  };

  approve = async (request: Request, response: Response) => this.reviewApproval(request, response, "Approved");

  reject = async (request: Request, response: Response) => this.reviewApproval(request, response, "Rejected");

  createAdjustment = async (request: Request, response: Response) => {
    const body = request.body as CreateAdjustmentBody;
    const authEmail = request.authUser?.email?.trim().toLowerCase();
    let submittedBy = body.submittedBy.trim();
    if (authEmail) {
      const directoryUser = await this.service.findUserByEmail(authEmail);
      if (directoryUser?.name?.trim()) {
        submittedBy = directoryUser.name.trim();
      }
    }
    const row = await this.service.createAdjustment({ ...body, submittedBy });
    response.status(201).json(row);
  };

  listAdjustments = async (request: Request, response: Response) => {
    const sessionIdRaw = request.query.sessionId;
    const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw : undefined;
    const role = request.authUser?.role ?? "User";

    if (role === "User") {
      const authEmail = request.authUser?.email?.trim().toLowerCase();
      if (!authEmail) { response.json([]); return; }
      const signedInUser = await this.service.findUserByEmail(authEmail);
      if (!signedInUser || signedInUser.accountEnabled === false) { response.json([]); return; }
      const selfName = signedInUser.name?.trim();
      if (!selfName) { response.json([]); return; }
      const rows = await this.service.listAdjustments({ submittedBy: selfName, sessionId });
      response.json(rows);
      return;
    }

    const rows = await this.service.listAdjustments({ sessionId });
    response.json(rows);
  };

  listCountHistory = async (request: Request, response: Response) => {
    const submittedByRaw = request.query.submittedBy;
    const sessionIdRaw = request.query.sessionId;
    const submittedBy =
      typeof submittedByRaw === "string"
        ? submittedByRaw
        : Array.isArray(submittedByRaw) && typeof submittedByRaw[0] === "string"
        ? submittedByRaw[0]
        : undefined;
    const sessionId =
      typeof sessionIdRaw === "string"
        ? sessionIdRaw
        : Array.isArray(sessionIdRaw) && typeof sessionIdRaw[0] === "string"
        ? sessionIdRaw[0]
        : undefined;
    const role = request.authUser?.role ?? "User";

    if (role === "User") {
      const authEmail = request.authUser?.email?.trim().toLowerCase();
      if (!authEmail) {
        response.json([]);
        return;
      }

      const signedInUser = await this.service.findUserByEmail(authEmail);
      if (!signedInUser || signedInUser.accountEnabled === false) {
        throw new HttpError(403, "User is not allowed to access history");
      }

      const selfName = signedInUser.name?.trim();
      if (!selfName) {
        response.json([]);
        return;
      }

      const activeVisibleSessions = (await this.service.listSessions()).filter(
        (session) => session.status === "Active" && session.userVisible
      );
      const activeVisibleSessionIds = new Set(activeVisibleSessions.map((session) => session.id));
      const allowedNames = new Set<string>([normalizePersonName(selfName)]);

      const pairsBySession = await Promise.all(activeVisibleSessions.map((session) => this.service.listPairs(session.id)));
      pairsBySession.forEach((pairs) => {
        pairs.forEach((pair) => {
          const memberNames = [pair.counter, pair.checker, pair.counter2].filter(
            (name): name is string => typeof name === "string" && name.trim().length > 0
          );
          const inSamePair = memberNames.some((name) => normalizePersonName(name) === normalizePersonName(selfName));
          if (!inSamePair) {
            return;
          }
          memberNames.forEach((name) => allowedNames.add(normalizePersonName(name)));
        });
      });

      const scopedRows = (await this.service.listCountHistory({ sessionId }))
        .filter((row) => activeVisibleSessionIds.has(row.sessionId))
        .filter((row) => allowedNames.has(normalizePersonName(row.submittedBy)));

      if (submittedBy && submittedBy.trim()) {
        const needle = submittedBy.trim().toLowerCase();
        response.json(scopedRows.filter((row) => row.submittedBy.toLowerCase().includes(needle)));
        return;
      }

      response.json(scopedRows);
      return;
    }

    const rows = await this.service.listCountHistory({ submittedBy, sessionId });
    response.json(rows);
  };

  listUsers = async (_request: Request, response: Response) => {
    const rows = await this.service.listUsers();
    response.json(rows);
  };

  updateUserRole = async (request: Request, response: Response) => {
    const userId = toSingleString(request.params.id, "id");
    const body = request.body as UserRoleUpdateBody;
    const row = await this.service.updateUserRole(userId, body.role);
    await this.metadataSync?.syncRole(userId, body.role);
    response.json(row);
  };
}
