-- Approval atomicity migration
-- Date: 2026-04-06
-- Goal: make approval review + item update + audit insert transactional.

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

    v_approved_bin := coalesce(
      nullif(v_adj.new_bin_location, ''),
      nullif(v_adj.old_bin_location, ''),
      v_item.bin_location
    );

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
