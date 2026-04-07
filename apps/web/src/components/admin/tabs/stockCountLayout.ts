const ITEM_MASTER_LAYOUT_STORAGE_PREFIX = "sta:item-master-layout";
const COLUMN_WIDTH_CHAR_PX = 9.5;
const COLUMN_WIDTH_FRAME_PX = 40;

export const COLUMN_WIDTH_MIN = 56;
export const COLUMN_WIDTH_MAX = 520;

export function calculateDefaultColumnWidth(label: string): number {
  const normalizedLength = Math.max(1, label.trim().length);
  const measuredWidth = Math.ceil(normalizedLength * COLUMN_WIDTH_CHAR_PX + COLUMN_WIDTH_FRAME_PX);
  return Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, measuredWidth));
}

export function buildItemMasterLayoutStorageKey(userScope: string, sessionId: string): string {
  const normalizedUserScope = userScope?.trim() || "anon";
  return `${ITEM_MASTER_LAYOUT_STORAGE_PREFIX}:${normalizedUserScope}:${sessionId}`;
}

