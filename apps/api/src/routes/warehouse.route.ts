import { Router } from "express";
import { WarehouseController } from "../controllers/warehouse.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { countSubmissionSchema, warehouseAssignedSchema, warehouseSearchSchema } from "../validation/schemas";

export function createWarehouseRouter(controller: WarehouseController): Router {
  const router = Router();

  router.get(
    "/warehouse/bins",
    requireRole("Admin", "Super Admin", "User"),
    asyncHandler(controller.listBins)
  );
  router.get(
    "/warehouse/wh-codes",
    requireRole("Admin", "Super Admin", "User"),
    asyncHandler(controller.listWhCodes)
  );
  router.get(
    "/warehouse/items",
    requireRole("Admin", "Super Admin", "User"),
    validateQuery(warehouseSearchSchema),
    asyncHandler(controller.searchItems)
  );
  router.get(
    "/warehouse/assigned",
    requireRole("Admin", "Super Admin", "User"),
    validateQuery(warehouseAssignedSchema),
    asyncHandler(controller.listAssignedItems)
  );
  router.post(
    "/warehouse/counts",
    requireRole("Admin", "Super Admin", "User"),
    validateBody(countSubmissionSchema),
    asyncHandler(controller.submitCount)
  );

  return router;
}
