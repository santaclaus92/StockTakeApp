import { state } from './store.js';
import { sb } from './supabase.js';

var deleteSessId = null;
var _pendingBadgePoll = null;

export function goSessions() { if (_pendingBadgePoll) { clearInterval(_pendingBadgePoll); _pendingBadgePoll = null; } requireAdmin(function () { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); document.getElementById('page-sessions').classList.add('active'); document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); }); document.getElementById('nav-sessions').classList.add('active'); mnavSetActive('mnav-sessions'); document.getElementById('bc-sep').style.display = 'none'; document.getElementById('bc-cur').style.display = 'none'; document.getElementById('topbar-right').innerHTML = ''; renderSessTable(); }); }
    function goDetail() { requireAdmin(function () { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); document.getElementById('page-detail').classList.add('active'); document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); }); document.getElementById('nav-detail').classList.add('active'); }); }
    function fmtDate(d) { if (!d) return '—'; var dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    function fmtRange(s, e) { return fmtDate(s) + ' – ' + fmtDate(e); }
    function renderSessTable() {
      var tb = document.getElementById('sess-tbody'); tb.innerHTML = ''; state.S.forEach(function (s) {
        var sc = s.status === 'Active' ? 'b-success' : s.status === 'Closed' ? 'b-gray' : 'b-warn'; var rcTag = s.rc ? '<span class="badge b-purple" style="margin-left:5px;font-size:10px;">Recount</span>' : ''; var reopenBtn = s.status === 'Closed' ? '<button class="btn btn-sm" style="color:#d97706;border-color:#fde68a;" onclick="event.stopPropagation();reopenSession(\'' + s.id + '\')">↺ Reopen</button>' : ''; var actionsHtml = '<div style="display:flex;gap:5px;justify-content:flex-end;"><button class="btn btn-sm" onclick="event.stopPropagation();openEditSession(\'' + s.id + '\')">✎ Edit</button>' + reopenBtn + '<button class="btn btn-sm" style="color:#e53e3e;border-color:#fca5a5;" onclick="event.stopPropagation();deleteSession(\'' + s.id + '\')">✕ Delete</button></div>';
        var tr = document.createElement('tr'); tr.style.cursor = 'pointer'; tr.onclick = function () { openSession(s.id); }; tr.style.opacity = s.userVisible ? '1' : '0.6';
        tr.innerHTML = '<td><div style="font-size:12px;font-weight:600;color:#1a202c;">' + s.name + rcTag + '</div></td><td>' + s.type + '</td><td>' + s.entity + '</td><td style="font-size:11px;white-space:nowrap;">' + fmtRange(s.start, s.end) + '</td><td><span class="badge ' + sc + '">' + s.status + '</span></td><td><div style="display:flex;align-items:center;gap:4px;"><div class="prog-bar" style="width:60px;margin:0;"><div class="prog-fill" style="width:' + s.progress + '%;' + (s.progress === 100 ? 'background:#1D9E75;' : '') + '"></div></div><span style="font-size:11px;">' + s.progress + '%</span></div></td><td>' + actionsHtml + '</td>'; tb.appendChild(tr);
      });
    }

export function openSession(sid) { state.curSessId = sid; if (_pendingBadgePoll) clearInterval(_pendingBadgePoll); if (window.refreshPendingBadge) { window.refreshPendingBadge(); _pendingBadgePoll = setInterval(window.refreshPendingBadge, 60000); } var s = cs(); document.getElementById('bc-sep').style.display = ''; document.getElementById('bc-cur').style.display = ''; document.getElementById('bc-cur').textContent = s.name; document.getElementById('topbar-right').innerHTML = ''; goDetail(); document.querySelectorAll('.stab').forEach(function (t) { t.classList.remove('active'); }); document.getElementById('stab-pairs').classList.add('active'); showTab('pairs', null); renderSessHeader(); renderPairBanner(); renderPairs(); loadItems(); renderGallery(); var rc = isRC(); document.getElementById('pair-form-normal').style.display = rc ? 'none' : ''; document.getElementById('pair-form-recount').style.display = rc ? '' : 'none'; document.getElementById('col-pair').style.display = rc ? '' : 'none'; document.getElementById('col-src').style.display = rc ? '' : 'none'; ['col-p1cnt','col-p1by','col-p1bin'].forEach(function(id){ document.getElementById(id).style.display = rc ? '' : 'none'; }); document.getElementById('items-sub').textContent = rc ? '"Assigned to pair" is editable for recount sessions.' : 'Drop items to exclude from this session.'; }
    function renderSessHeader() { var s = cs(); var rc = isRC(); var statusC = s.status === 'Active' ? '#4ade80' : s.status === 'Closed' ? 'rgba(255,255,255,0.45)' : '#fbbf24'; var rcBadge = rc ? '<span class="badge b-purple" style="margin-left:6px;">Recount</span>' : ''; var linked = !rc ? linkedRC(s.id) : null; var visToggle = s.userVisible ? '<button class="btn btn-sm btn-success" onclick="toggleSessionVisibility(\'' + s.id + '\')">👁 Visible to users</button>' : '<button class="btn btn-sm" style="color:#9ca3af;border-color:#e2e8f0;" onclick="toggleSessionVisibility(\'' + s.id + '\')">🚫 Hidden from users</button>'; var actionBtns = visToggle + '<button class="btn btn-success btn-sm" onclick="showTab(\'dashboard\',document.getElementById(\'stab-dashboard\'));buildDashboard();">&#9783; Dashboard</button>'; if (s.status === 'Active') { actionBtns += '<button class="btn btn-danger btn-sm" onclick="openEndModal()">&#9632; End session</button>'; } var parentLine = ''; if (rc && s.parentId) { var ps = state.S.find(function (x) { return x.id === s.parentId; }); parentLine = '<div style="margin-top:10px;" class="banner bn-purple">Recount — linked to parent session: <strong>' + (ps ? ps.name : s.parentId) + '</strong></div>'; } if (linked) { parentLine = '<div style="margin-top:10px;" class="banner bn-warn">Variance items &amp; new items will be passed to recount session <strong>' + linked.name + '</strong> when ended.</div>'; } document.getElementById('sess-hdr').innerHTML = '<div class="sess-hdr-top"><div><div style="display:flex;align-items:center;gap:6px;"><div class="sess-title">' + s.name + '</div>' + rcBadge + '</div><div class="sess-id">' + s.type + ' · ' + s.entity + ' · ' + fmtRange(s.start, s.end) + '</div></div><div class="sess-actions">' + actionBtns + '</div></div><div class="sess-meta-row"><div class="meta-chip"><div class="meta-lbl">Status</div><div class="meta-val" style="color:' + statusC + '">● ' + s.status + '</div></div><div class="meta-chip"><div class="meta-lbl">Progress</div><div class="meta-val">' + s.progress + '%</div></div><div class="meta-chip"><div class="meta-lbl">Country</div><div class="meta-val">' + s.country + '</div></div>' + (rc && s.parentId ? '<div class="meta-chip"><div class="meta-lbl">Parent session</div><div class="meta-val">' + (ps ? ps.name : s.parentId) + '</div></div>' : '') + (linked ? '<div class="meta-chip"><div class="meta-lbl">Recount session</div><div class="meta-val">' + linked.name + '</div></div>' : '') + '</div>' + parentLine; }
    function openEndModal() { var s = cs(); var rc = isRC(); var vItems = varItems(); var nItems = approvedNew(); var linked = !rc ? linkedRC(s.id) : null; document.getElementById('em-title').textContent = 'End session — ' + s.id; document.getElementById('em-sub').textContent = rc ? 'Closing this recount session will lock all counts and mark it as Closed.' : 'Review the handoff before ending this session.'; var bodyHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;"><div class="stat-box"><div class="stat-lbl">Active items</div><div class="stat-val">' + state.items.filter(function (i) { return !i.dropped; }).length + '</div></div><div class="stat-box"><div class="stat-lbl">Variance items</div><div class="stat-val" style="color:#d97706;">' + vItems.length + '</div></div><div class="stat-box"><div class="stat-lbl">New items</div><div class="stat-val" style="color:#1b3764;">' + nItems.length + '</div></div></div>'; if (!rc) { if (linked) { bodyHtml += '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Items to pass → <span style="color:#1b3764;">' + linked.id + '</span> as item master</div>'; if (vItems.length === 0 && nItems.length === 0) { bodyHtml += '<div class="banner bn-success">No variance or new items — nothing to pass to recount session.</div>'; } else { vItems.forEach(function (i) { var st = i.cnt === null ? 'Not found' : 'Variance'; var bc = i.cnt === null ? 'b-danger' : 'b-warn'; bodyHtml += '<div class="hrow"><span class="hrow-code">' + i.code + '</span><span class="hrow-name">' + i.name + '</span><span class="badge ' + bc + '">' + st + '</span></div>'; }); nItems.forEach(function (n) { bodyHtml += '<div class="hrow"><span class="hrow-code">NEW</span><span class="hrow-name">' + n.name + '</span><span class="badge b-purple">New item</span></div>'; }); } } else { if (vItems.length > 0 || nItems.length > 0) { bodyHtml += '<div class="banner bn-danger">&#10060; Cannot end session — <strong>' + (vItems.length + nItems.length) + ' variance / new item(s)</strong> have nowhere to go. Create a linked recount session first, then end this session.</div>'; } else { bodyHtml += '<div class="banner bn-info">No linked recount session. No variance or new items — safe to end.</div>'; } } } var blocked = !rc && !linked && (vItems.length > 0 || nItems.length > 0); document.getElementById('em-body').innerHTML = bodyHtml; var footer = document.getElementById('em-footer'); footer.innerHTML = ''; var cb = document.createElement('button'); cb.className = 'btn btn-danger'; cb.style.flex = '1'; if (blocked) { cb.disabled = true; cb.style.opacity = '0.4'; cb.style.cursor = 'not-allowed'; cb.title = 'Create a linked recount session first'; } cb.textContent = (!rc && linked) ? 'End & pass to recount session' : 'Confirm end session'; cb.onclick = function () { if (blocked) return; doEnd(!rc && !!linked, linked); }; var cx = document.createElement('button'); cx.className = 'btn'; cx.textContent = 'Cancel'; cx.onclick = function () { document.getElementById('end-modal-wrap').style.display = 'none'; }; var topBar = document.createElement('div'); topBar.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;'; topBar.appendChild(cb); topBar.appendChild(cx); document.getElementById('em-body').prepend(topBar); document.getElementById('end-modal-wrap').style.display = ''; }
    function doEnd(pass, linked) {
      var s = cs();
      s.status = 'Closed'; s.progress = 100;
      sb.from('sessions').update({ status: 'Closed', progress: 100 }).eq('id', s.id).then(function () { });
      document.getElementById('end-modal-wrap').style.display = 'none';
      renderSessHeader();
      if (!pass || !linked) { goSessions(); return; }

      // Fetch recount session pairs first so we can auto-assign
      sb.from('pairs').select('id,role,warehouse_id,counter_name,checker_name').eq('session_id', linked.id).then(function (pRes) {
        var rcPairs = (!pRes.error && pRes.data) ? pRes.data : [];
        var adminPair = rcPairs.find(function (p) { return p.role === 'Admin'; });

        function pairLabel(p) {
          if (!p) return null;
          var parts = [p.counter_name, p.checker_name].filter(Boolean);
          return parts.length ? parts.join(' / ') : null;
        }

        // Find a pair whose warehouse_id list contains any of the item's bin locations
        function pairByBin(binLoc) {
          if (!binLoc || binLoc === '\u2014') return null;
          var bins = binLoc.split(';').map(function (b) { return b.trim(); }).filter(Boolean);
          for (var b = 0; b < bins.length; b++) {
            var bin = bins[b];
            var match = rcPairs.find(function (p) {
              return (p.warehouse_id || '').split(',').map(function (x) { return x.trim(); }).indexOf(bin) !== -1;
            });
            if (match) return match;
          }
          return null;
        }

        var toInsert = [], idx = 0, base = Date.now();
        // For new items only: deduplicate by code+batch (same item submitted multiple times by users)
        var seenNewKeys = {};

        varItems().forEach(function (i) {
          // Skip duplicate new items (same code+batch already queued)
          if (i.newItem === 'Yes') {
            var nk = (i.code || '') + '|' + (i.batch && i.batch !== '\u2014' ? i.batch : '');
            if (seenNewKeys[nk]) return;
            seenNewKeys[nk] = true;
          }
          idx++;
          var iStatus = i.newItem === 'Yes' ? 'New item' : (i.cnt === null ? 'Not found' : 'Variance');
          var pairId = null;
          var assignedTo = null;
          if (i.newItem === 'Yes') {
            // New item → assign to admin pair
            pairId = adminPair ? adminPair.id : null;
            assignedTo = pairLabel(adminPair);
          } else if (i.cnt !== null && i.cnt !== undefined && i.cnt !== '') {
            // Variance → assign by bin location
            var mp = pairByBin(i.warehouse);
            pairId = mp ? mp.id : null;
            assignedTo = pairLabel(mp);
          }
          // Not found (cnt === null) → pairId and assignedTo stay null
          toInsert.push({ id: 'RC-' + base + '-' + idx, session_id: linked.id,
            code: i.code, name: i.name, group: i.grp,
            batch: (i.batch && i.batch !== '\u2014') ? i.batch : null,
            uom: i.uom || 'PCS',
            bin_location: (i.warehouse && i.warehouse !== '\u2014') ? i.warehouse : null,
            wh_code: i.wh || null, entity: i.entity || null,
            expiry_date: i.expiry || null, category: i.category || null,
            cost: i.cost || 0, packaging_size: i.pkg || null,
            dropped: false, sap_qty: i.sap, count_qty: null,
            submitted_by: null, pair_id: pairId, assigned_to: assignedTo,
            new_item: i.newItem || 'No', item_status: iStatus, variance: 0 });
        });

        linked.status = 'Active';
        sb.from('sessions').update({ status: 'Active' }).eq('id', linked.id).then(function () { });
        if (toInsert.length) {
          sb.from('items').delete().eq('session_id', linked.id).then(function (delRes) {
            if (delRes.error) { alert('Failed to clear recount session items: ' + delRes.error.message); return; }
            sb.from('items').insert(toInsert).then(function (res) {
              if (res.error) { alert('Failed to pass items to recount session: ' + res.error.message); }
            });
          });
        }
        goSessions();
      });
    }

export function toggleNSForm() { var f = document.getElementById('ns-modal-wrap'); f.style.display = f.style.display === 'none' ? '' : 'none'; if (f.style.display === 'none') resetNSForm(); }

    function openEditSession(sid) {
      state.editSessId = sid;
      var s = state.S.find(function (x) { return x.id === sid; });
      document.getElementById('es-sub').textContent = 'ID: ' + s.id;
      document.getElementById('es-name').value = s.name;
      document.getElementById('es-type').value = s.type;
      document.getElementById('es-country').value = s.country;
      onEditCountry();
      document.getElementById('es-entity').value = s.entity;
      setCalPickerVal('es-start', s.start);
      setCalPickerVal('es-end', s.end);
      ['es-name', 'es-type', 'es-country', 'es-entity', 'es-start', 'es-end'].forEach(clearFerr);
      document.getElementById('es-gen-err').style.display = 'none';
      document.getElementById('es-modal-wrap').style.display = '';
    }

export function closeEditSession() { document.getElementById('es-modal-wrap').style.display = 'none'; state.editSessId = null; }

    function onEditCountry() { var c = document.getElementById('es-country').value, e = document.getElementById('es-entity'); e.innerHTML = '<option value="">Select…</option>'; if (c === 'Malaysia') e.innerHTML += '<option>BMS</option><option>BMSD</option>'; else if (c === 'Singapore') e.innerHTML += '<option>BMSG</option>'; }

    function saveEditSession() {
      ['es-name', 'es-type', 'es-country', 'es-entity', 'es-start', 'es-end'].forEach(clearFerr);
      document.getElementById('es-gen-err').style.display = 'none';
      var n = document.getElementById('es-name').value.trim(), t = document.getElementById('es-type').value, co = document.getElementById('es-country').value, en = document.getElementById('es-entity').value, st = document.getElementById('es-start').value, ed = document.getElementById('es-end').value;
      var ok = true;
      if (!n) { markFerr('es-name'); ok = false; } if (!t) { markFerr('es-type'); ok = false; } if (!co) { markFerr('es-country'); ok = false; } if (!en) { markFerr('es-entity'); ok = false; } if (!st) { markFerr('es-start'); ok = false; } if (!ed) { markFerr('es-end'); ok = false; }
      if (!ok) { document.getElementById('es-gen-err').style.display = ''; return; }
      var s = state.S.find(function (x) { return x.id === state.editSessId; });
      s.name = n; s.type = t; s.country = co; s.entity = en; s.start = st; s.end = ed;
      sb.from('sessions').update({ name: n, type: t, country: co, entity: en, start_date: st, end_date: ed }).eq('id', state.editSessId).then(function (res) {
        if (res.error) { alert('Failed to save: ' + res.error.message); return; }
        closeEditSession(); renderSessTable();
        if (state.curSessId === state.editSessId) renderSessHeader();
      });
    }

export function reopenSession(sid) {
      if (!confirm('Reopen this session? Status will be set back to Active.')) return;
      var s = state.S.find(function (x) { return x.id === sid; });
      s.status = 'Active';
      sb.from('sessions').update({ status: 'Active' }).eq('id', sid).then(function (res) {
        if (res.error) { alert('Failed to reopen: ' + res.error.message); return; }
        renderSessTable();
        if (state.curSessId === sid) renderSessHeader();
      });
    }

export function deleteSession(sid) {
      var s = state.S.find(function (x) { return x.id === sid; });
      if (!s) return;
      deleteSessId = sid;
      document.getElementById('del-sess-name').textContent = '"' + s.name + '"';
      document.getElementById('del-sess-input').value = '';
      document.getElementById('del-sess-btn').disabled = true;
      document.getElementById('del-sess-wrap').style.display = '';
    }

export function confirmDeleteSession() {
      if (!deleteSessId) return;
      var s = state.S.find(function (x) { return x.id === deleteSessId; });
      document.getElementById('del-sess-wrap').style.display = 'none';
      // Write deletion record to hidden audit table before deleting
      var record = {
        id: 'DEL-' + Date.now().toString(36).toUpperCase(),
        session_id: deleteSessId,
        session_name: s ? s.name : deleteSessId,
        deleted_by: state.ssoUserName || 'unknown',
        deleted_at: new Date().toISOString()
      };
      sb.from('session_deletions').insert(record).then(function (logRes) {
        if (logRes.error) { console.error('session_deletions insert failed:', logRes.error.message); }
        var sidToDelete = deleteSessId;
        sb.from('sessions').delete().eq('id', sidToDelete).then(function (res) {
          if (res.error) { alert('Failed to delete: ' + res.error.message); return; }
          state.S = state.S.filter(function (x) { return x.id !== sidToDelete; });
          if (state.curSessId === sidToDelete) { state.curSessId = null; goSessions(); }
          deleteSessId = null;
          renderSessTable();
        });
      });
    }

export function toggleSessionVisibility(sid) {
      var s = state.S.find(function (x) { return x.id === sid; });
      if (!s || s.status === 'Closed') return;
      var prevVisible = s.userVisible;
      var prevStatus = s.status;
      s.userVisible = !s.userVisible;
      s.status = s.userVisible ? 'Active' : 'Draft';
      // Update UI immediately (optimistic)
      renderSessTable();
      if (state.curSessId === sid) renderSessHeader();
      sb.from('sessions').update({ user_visible: s.userVisible, status: s.status }).eq('id', sid).then(function (res) {
        if (res.error) {
          alert('Failed to update: ' + res.error.message);
          s.userVisible = prevVisible;
          s.status = prevStatus;
          renderSessTable();
          if (state.curSessId === sid) renderSessHeader();
        }
      });
    }

export function onCountry() { var c = document.getElementById('ns-country').value, e = document.getElementById('ns-entity'); e.innerHTML = '<option value="">Select…</option>'; if (c === 'Malaysia') e.innerHTML += '<option>BMS</option><option>BMSD</option>'; else if (c === 'Singapore') e.innerHTML += '<option>BMSG</option>'; }
    function onRcToggle() { var ck = document.getElementById('ns-rc').checked; document.getElementById('ns-rc-box').style.display = ck ? '' : 'none'; if (ck) { var sel = document.getElementById('ns-parent'); sel.innerHTML = '<option value="">Select parent session…</option>'; state.S.filter(function (s) { return !s.rc && s.status !== 'Archived'; }).forEach(function (s) { sel.innerHTML += '<option value="' + s.id + '">' + s.id + ' — ' + s.name + '</option>'; }); } }
    function clearFerr(id) { var el = document.getElementById(id); if (el) el.classList.remove('err'); var trig = document.getElementById('caltrig-' + id); if (trig) trig.classList.remove('err'); var er = document.getElementById(id + '-err'); if (er) er.style.display = 'none'; }
    function markFerr(id) { var el = document.getElementById(id); if (el) el.classList.add('err'); var trig = document.getElementById('caltrig-' + id); if (trig) trig.classList.add('err'); var er = document.getElementById(id + '-err'); if (er) er.style.display = ''; }
    function createSession() { ['ns-name', 'ns-type', 'ns-country', 'ns-entity', 'ns-start', 'ns-end', 'ns-parent'].forEach(clearFerr); document.getElementById('ns-gen-err').style.display = 'none'; var n = document.getElementById('ns-name').value.trim(), t = document.getElementById('ns-type').value, co = document.getElementById('ns-country').value, en = document.getElementById('ns-entity').value, st = document.getElementById('ns-start').value, ed = document.getElementById('ns-end').value, rc = document.getElementById('ns-rc').checked, pid = rc ? document.getElementById('ns-parent').value : ''; var ok = true; if (!n) { markFerr('ns-name'); ok = false; } if (!t) { markFerr('ns-type'); ok = false; } if (!co) { markFerr('ns-country'); ok = false; } if (!en) { markFerr('ns-entity'); ok = false; } if (!st) { markFerr('ns-start'); ok = false; } if (!ed) { markFerr('ns-end'); ok = false; } if (rc && !pid) { markFerr('ns-parent'); ok = false; } if (!ok) { document.getElementById('ns-gen-err').style.display = ''; return; } var cc = co === 'Malaysia' ? 'MY' : 'SG', yr = st.slice(0, 4), tc = t === 'Year End' ? 'YE' : 'CC'; var newId = (rc ? 'RC' : tc) + yr + '-' + cc + '-' + (String(state.S.length + 1).padStart(3, '0')); state.S.push({ id: newId, name: n, type: t, entity: en, country: co, start: st, end: ed, status: 'Draft', progress: 0, rc: rc, parentId: rc ? pid : null, userVisible: false }); document.getElementById('ns-modal-wrap').style.display = 'none'; resetNSForm(); renderSessTable(); sb.from('sessions').insert({ id: newId, name: n, type: t, entity: en, country: co, start_date: st, end_date: ed, status: 'Draft', progress: 0, is_recount: rc, parent_id: rc ? pid : null, user_visible: false }).then(function (res) { if (res.error) alert('Failed to save session: ' + res.error.message); }); }
    function resetNSForm() { ['ns-name', 'ns-start', 'ns-end'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; }); setCalPickerVal('ns-start', ''); setCalPickerVal('ns-end', ''); document.getElementById('ns-type').value = ''; document.getElementById('ns-country').value = ''; document.getElementById('ns-entity').innerHTML = '<option value="">Select…</option>'; document.getElementById('ns-rc').checked = false; document.getElementById('ns-rc-box').style.display = 'none';['ns-name', 'ns-type', 'ns-country', 'ns-entity', 'ns-start', 'ns-end', 'ns-parent'].forEach(clearFerr); document.getElementById('ns-gen-err').style.display = 'none'; }

    function mapItem(i) {
      var expRaw = i.expiry_date || i.expiry || null;
      var expStr = expRaw ? (typeof expRaw === 'string' ? expRaw.split('T')[0] : String(expRaw)) : null;
      return {
        id: i.id, code: i.code || '', name: i.name || '', grp: i.grp || i.group || i.group_name || '',
        batch: i.batch || '\u2014', uom: i.uom || 'PCS', pairId: i.pair_id || i.pairId || null,
        warehouse: i.bin_location || '\u2014', dropped: !!(i.dropped || i.is_dropped),
        sap: +(i.sap || i.sap_qty || i.sapQty || 0),
        cnt: (i.cnt !== undefined && i.cnt !== null) ? +i.cnt : (i.count_qty !== undefined && i.count_qty !== null ? +i.count_qty : (i.countQty !== undefined && i.countQty !== null ? +i.countQty : null)),
        dmg: (i.dmg !== undefined && i.dmg !== null) ? +i.dmg : (i.damaged_qty !== undefined && i.damaged_qty !== null ? +i.damaged_qty : null),
        expQty: (i.exp_qty !== undefined && i.exp_qty !== null) ? +i.exp_qty : (i.expired_qty !== undefined && i.expired_qty !== null ? +i.expired_qty : null),
        remark: i.remark || '',
        photos: (typeof i.photos === 'string' ? (function (s) { try { return JSON.parse(s); } catch (e) { return []; } })(i.photos) : (Array.isArray(i.photos) ? i.photos : [])),
        src: i.src || null,
        expiry: expStr,
        category: i.category || '',
        cost: +(i.cost || 0),
        entity: i.entity || '',
        wh: i.wh_code || '',
        pkg: i.packaging_size || i.pkg_size || i.pkg || null,
        newItem: i.new_item || 'No',
        assignedTo: i.assigned_to || null,
        itemStatus: i.item_status || null,
        submittedBy: i.submitted_by || null
      };
    }

export function loadSessions() {
      sb.from('sessions').select('*').order('created_at', { ascending: false }).then(function (res) {
        if (res.error) { console.error(res.error); renderSessTable(); return; }
        state.S = (res.data || []).map(function (s) {
          return {
            id: s.id, name: s.name, type: s.type, entity: s.entity, country: s.country,
            start: s.start_date, end: s.end_date, status: s.status,
            progress: s.progress || 0, rc: !!s.is_recount, parentId: s.parent_id || null,
            userVisible: s.user_visible !== false
          };
        });
        renderSessTable();
      });
    }

// --- Global Window Exports ---
window.goSessions = goSessions;
window.renderSessTable = renderSessTable;
window.openSession = openSession;
window.renderSessHeader = renderSessHeader;
window.openEndModal = openEndModal;
window.doEnd = doEnd;
window.toggleNSForm = toggleNSForm;
window.openEditSession = openEditSession;
window.closeEditSession = closeEditSession;
window.onEditCountry = onEditCountry;
window.saveEditSession = saveEditSession;
window.reopenSession = reopenSession;
window.deleteSession = deleteSession;
window.confirmDeleteSession = confirmDeleteSession;
window.toggleSessionVisibility = toggleSessionVisibility;
window.onCountry = onCountry;
window.onRcToggle = onRcToggle;
window.createSession = createSession;
window.resetNSForm = resetNSForm;
window.loadSessions = loadSessions;
window.goDetail = goDetail;
window.fmtDate = fmtDate;
window.fmtRange = fmtRange;
window.clearFerr = clearFerr;
window.markFerr = markFerr;
window.mapItem = mapItem;
