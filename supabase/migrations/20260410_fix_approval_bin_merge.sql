-- Bin location merge fix for approval RPC
-- Date: 2026-04-10
-- Goal: on approval, remove old_bin segments from current bin_location and add new_bin segments
--       instead of purely overwriting bin_location.

BEGIN;

CREATE OR REPLACE FUNCTION public.sta_act_on_approval(
  p_session_id text,
  p_approval_id text,
  p_action text,
  p_reviewed_by text
)
RETURNS TABLE(
  id text,
  item_code text,
  item_name text,
  old_qty numeric,
  new_qty numeric,
  old_bin_location text,
  new_bin_location text,
  status text,
  submitted_by text,
  created_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adj public.count_adjustments%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_now timestamptz := now();
  v_old_qty numeric;
  v_new_qty numeric;
  v_current_qty numeric;
  v_adjusted_qty numeric;
  v_sap_qty numeric;
  v_approved_bin text;
  v_item_status text;
  v_remark text;
  v_current_bins text[];
  v_old_bins text[];
  v_new_bins text[];
  v_merged_bins text[];
  v_b text;
BEGIN
  IF p_action NOT IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid approval action: %', p_action USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_adj
  FROM public.count_adjustments
  WHERE session_id = p_session_id
    AND id = p_approval_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF coalesce(v_adj.status, 'Pending') <> 'Pending' THEN
    RAISE EXCEPTION 'Approval record has already been reviewed as %', v_adj.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.count_adjustments
  SET status = p_action,
      reviewed_by = p_reviewed_by,
      reviewed_at = v_now
  WHERE session_id = p_session_id
    AND id = p_approval_id;

  IF p_action = 'Approved' AND coalesce(v_adj.item_id, '') <> '' THEN
    SELECT *
    INTO v_item
    FROM public.items
    WHERE id = v_adj.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Approval target item not found' USING ERRCODE = 'P0002';
    END IF;

    v_current_qty := coalesce(v_item.count_qty, 0);
    v_old_qty := coalesce(v_adj.old_qty, 0);
    v_new_qty := coalesce(v_adj.new_qty, 0);
    v_adjusted_qty := v_current_qty - v_old_qty + v_new_qty;
    v_sap_qty := coalesce(v_item.sap_qty, 0);

    IF v_adjusted_qty = v_sap_qty THEN
      v_item_status := 'Matched';
    ELSE
      v_item_status := 'Variance';
    END IF;

    -- Build current, old, and new bin arrays (split by ';', trim, drop empty)
    SELECT array_agg(trim(x))
    INTO v_current_bins
    FROM unnest(string_to_array(coalesce(v_item.bin_location, ''), ';')) AS x
    WHERE trim(x) <> '';

    SELECT array_agg(trim(x))
    INTO v_old_bins
    FROM unnest(string_to_array(coalesce(v_adj.old_bin_location, ''), ';')) AS x
    WHERE trim(x) <> '';

    SELECT array_agg(trim(x))
    INTO v_new_bins
    FROM unnest(string_to_array(coalesce(v_adj.new_bin_location, ''), ';')) AS x
    WHERE trim(x) <> '';

    v_current_bins := coalesce(v_current_bins, '{}');
    v_old_bins     := coalesce(v_old_bins, '{}');
    v_new_bins     := coalesce(v_new_bins, '{}');

    -- Remove old_bin segments from current bins
    SELECT array_agg(b)
    INTO v_merged_bins
    FROM unnest(v_current_bins) AS b
    WHERE NOT (b = ANY(v_old_bins));

    v_merged_bins := coalesce(v_merged_bins, '{}');

    -- Add new_bin segments (deduplicated)
    FOREACH v_b IN ARRAY v_new_bins LOOP
      IF NOT (v_b = ANY(v_merged_bins)) THEN
        v_merged_bins := array_append(v_merged_bins, v_b);
      END IF;
    END LOOP;

    v_approved_bin := nullif(array_to_string(v_merged_bins, ';'), '');

    UPDATE public.items
    SET count_qty = v_adjusted_qty,
        item_status = v_item_status,
        bin_location = v_approved_bin
    WHERE id = v_adj.item_id;

    v_remark := format(
      'Approved by %s: %s -> %s (adjusted: %s)',
      coalesce(p_reviewed_by, 'admin'),
      v_old_qty,
      v_new_qty,
      v_adjusted_qty
    );

    IF coalesce(v_adj.old_bin_location, '') <> ''
       AND coalesce(v_approved_bin, '') <> ''
       AND v_adj.old_bin_location <> v_approved_bin THEN
      v_remark := v_remark || format('; bin %s -> %s', v_adj.old_bin_location, v_approved_bin);
    END IF;

    INSERT INTO public.item_audit(
      id,
      session_id,
      item_id,
      item_code,
      item_name,
      submitted_by,
      count_qty,
      warehouse,
      remark,
      counted_at
    )
    VALUES (
      'AUD-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 5),
      p_session_id,
      v_adj.item_id,
      v_adj.item_code,
      v_adj.item_name,
      v_adj.submitted_by,
      v_adjusted_qty,
      v_approved_bin,
      v_remark,
      v_now
    );
  END IF;

  RETURN QUERY
  SELECT
    ca.id::text,
    ca.item_code::text,
    ca.item_name::text,
    ca.old_qty::numeric,
    ca.new_qty::numeric,
    ca.old_bin_location::text,
    ca.new_bin_location::text,
    ca.status::text,
    ca.submitted_by::text,
    ca.created_at,
    ca.reviewed_by::text,
    ca.reviewed_at
  FROM public.count_adjustments ca
  WHERE ca.session_id = p_session_id
    AND ca.id = p_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sta_act_on_approval(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sta_act_on_approval(text, text, text, text) TO service_role;

COMMIT;
