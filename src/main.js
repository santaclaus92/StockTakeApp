import { state } from './store.js';
import { sb, sbQuery, FN_BASE, FN_HEADERS } from './supabase.js';
import './auth.js';
import './sessions.js';

var usersList = [];
var attendees = [];

// ── Role-based access (set by server on login) ────────────────────────────
    
    
    // ── Constants ─────────────────────────────────────────────────────────────
    
    

    
    
    
    
    
    
    
    
    
    function cs() { return state.S.find(function (s) { return s.id === state.curSessId; }); }
    function isRC() { var s = cs(); return s && s.rc; }
    function varItems() { return state.items.filter(function (i) { return !i.dropped && (i.cnt === null || i.cnt !== i.sap); }); }
    function approvedNew() { return state.newItems.filter(function (n) { return n.status !== 'Rejected'; }); }
    function linkedRC(sid) { return state.S.find(function (s) { return s.rc && s.parentId === sid; }); }
    function mnavSetActive(id) { document.querySelectorAll('.mnav-btn').forEach(function (b) { b.classList.remove('active'); }); var el = document.getElementById(id); if (el) el.classList.add('active'); }


    function showTab(name, el) { ['pairs', 'attendance', 'items', 'dashboard', 'gallery', 'audit', 'pending'].forEach(function (t) { document.getElementById('tab-' + t).style.display = t === name ? '' : 'none'; }); document.querySelectorAll('.stab').forEach(function (t) { t.classList.remove('active'); }); (el || document.getElementById('stab-' + name)).classList.add('active'); if (name === 'pairs') { stopAttQr(); loadPairs(); } if (name === 'attendance') { loadAttendees(); startAttQr(); } if (name === 'items') { stopAttQr(); loadItems(); } if (name === 'dashboard') { stopAttQr(); buildDashboard(); } if (name === 'gallery') { stopAttQr(); loadItems(); } if (name === 'audit') { stopAttQr(); loadAudit(); } if (name === 'pending') { stopAttQr(); loadPendingApprovals(); } }
    function loadPairs() { if (!state.curSessId) return; sb.from('pairs').select('*').eq('session_id', state.curSessId).order('created_at', { ascending: true }).then(function (res) { if (res.error) { console.error(res.error); return; } var ini = function (n) { return (n || '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }; state.pairs = (res.data || []).map(function (p) { return { id: p.id, c: p.counter_name, ci: ini(p.counter_name), ca: !!p.counter_absent, k: p.checker_name, ki: ini(p.checker_name), ka: !!p.checker_absent, warehouse: p.warehouse_id || p.bin_id || '—', role: p.role || 'User', prog: p.progress || 0 }; }); renderPairs(); loadAttendees(); }); }

    function loadAttendees() {
      if (!state.curSessId) return;
      fetch(FN_BASE + '/save-attendance?session_id=' + encodeURIComponent(state.curSessId), { method: 'GET', headers: FN_HEADERS }).then(function (res) {
        return res.json();
      }).then(function (data) {
        if (data.error) { console.error('loadAttendees:', data.error); return; }
        var rows = data.attendees || [];
        attendees = rows.map(function (a) { return { userId: a.user_id, name: a.user_name, attended: !!a.attended }; });
        crossCheckPairsAttendance();
        renderAttendance();
        populateAttAddDropdown();
      }).catch(function (err) { console.error('loadAttendees network error:', err); });
    }

    function crossCheckPairsAttendance() {
      var toUpdate = [];
      state.pairs.forEach(function (p) {
        var cAtt = attendees.find(function (a) { return a.name === p.c; });
        var kAtt = attendees.find(function (a) { return a.name === p.k; });
        var newCa = cAtt ? !cAtt.attended : (attendees.length > 0 ? true : p.ca);
        var newKa = kAtt ? !kAtt.attended : (attendees.length > 0 ? true : p.ka);
        if (newCa !== p.ca || newKa !== p.ka) {
          p.ca = newCa; p.ka = newKa;
          toUpdate.push({ id: p.id, counter_absent: p.ca, checker_absent: p.ka });
        }
      });
      toUpdate.forEach(function (u) {
        sb.from('pairs').update({ counter_absent: u.counter_absent, checker_absent: u.checker_absent }).eq('id', u.id).then(function () { });
      });
      renderPairs();
    }


    function toggleAttendee(userId) {
      var a = attendees.find(function (x) { return x.userId === userId; });
      if (!a) return;
      a.attended = !a.attended;
      fetch(FN_BASE + '/save-attendance', { method: 'POST', headers: FN_HEADERS, body: JSON.stringify({ session_id: state.curSessId, user_id: a.userId, user_name: a.name, attended: a.attended }) }).then(function (r) { if (!r.ok) r.json().then(function(e){ console.error('save-attendance:', e.error); }); });
      crossCheckPairsAttendance();
      renderAttendance();
    }

    function renderAttendance() {
      var list = document.getElementById('attendance-list'); if (!list) return;
      var sub = document.getElementById('att-sub');
      if (!attendees.length) {
        list.innerHTML = '<div style="padding:24px;font-size:12px;color:#718096;text-align:center;">No attendees yet. Users can scan the QR code above, or add them manually.</div>';
        if (sub) sub.textContent = '';
        return;
      }
      var absent = attendees.filter(function (a) { return !a.attended; }).length;
      if (sub) sub.textContent = attendees.length + ' users · ' + (absent ? absent + ' absent' : 'all present');
      var grid = document.createElement('div');
      grid.className = 'att-grid';
      attendees.forEach(function (a) {
        var ini = a.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        var inPair = state.pairs.find(function (p) { return p.c === a.name || p.k === a.name; });
        var card = document.createElement('div');
        card.className = 'att-card' + (!a.attended ? ' absent' : '');
        var pairBadge = inPair ? '<span style="font-size:9px;font-weight:700;color:#1b3764;background:#e8f4fd;padding:1px 6px;border-radius:99px;">P' + (state.pairs.indexOf(inPair) + 1) + '</span>' : '';
        var warnBadge = (inPair && !a.attended) ? '<span style="font-size:9px;color:#c0392b;font-weight:600;">⚠ replace</span>' : '';
        var statusCls = a.attended ? 'present' : 'absent';
        var statusTxt = a.attended ? 'Present' : 'Absent';
        card.innerHTML = '<div class="att-av">' + ini + '</div><div class="att-name">' + a.name + '</div>' + pairBadge + warnBadge + '<span class="att-status ' + statusCls + '">' + statusTxt + '</span>';
        card.onclick = function () { toggleAttendee(a.userId); };
        grid.appendChild(card);
      });
      list.innerHTML = '';
      list.appendChild(grid);
    }
    function populateAttAddDropdown() {
      var sel = document.getElementById('att-add-select');
      if (!sel) return;
      // Show all users; grey out those already in list
      var existing = new Set(attendees.map(function (a) { return a.userId; }));
      var opts = '<option value="">Select user\u2026</option>';
      usersList.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (u) {
        var uid = (u.name || '').toLowerCase().replace(/\s+/g, '_');
        var alreadyIn = existing.has(uid) || existing.has(u.id);
        opts += '<option value="' + (u.id || uid) + '" data-name="' + u.name + '"' + (alreadyIn ? ' disabled style="color:#aaa;"' : '') + '>' + u.name + (alreadyIn ? ' (added)' : '') + '</option>';
      });
      sel.innerHTML = opts;
    }

    function addAttendeeManual() {
      var sel = document.getElementById('att-add-select');
      var msg = document.getElementById('att-add-msg');
      if (!sel || !sel.value) return;
      var opt = sel.options[sel.selectedIndex];
      var userId = sel.value;
      var userName = opt.getAttribute('data-name') || opt.textContent;
      // Avoid duplicates
      if (attendees.find(function (a) { return a.userId === userId; })) {
        if (msg) { msg.style.display = ''; msg.style.color = '#d97706'; msg.textContent = userName + ' is already in the list.'; }
        return;
      }
      var newAtt = { userId: userId, name: userName, attended: true };
      attendees.push(newAtt);
      crossCheckPairsAttendance();
      renderAttendance();
      populateAttAddDropdown();
      fetch(FN_BASE + '/save-attendance', { method: 'POST', headers: FN_HEADERS, body: JSON.stringify({ session_id: state.curSessId, user_id: userId, user_name: userName, attended: true }) }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function(e) {
            attendees = attendees.filter(function (a) { return a.userId !== userId; });
            if (msg) { msg.style.display = ''; msg.style.color = '#c0392b'; msg.textContent = 'Failed: ' + (e.error || 'Unknown error'); }
            renderAttendance();
            populateAttAddDropdown();
          });
        }
        if (msg) { msg.style.display = ''; msg.style.color = '#1D9E75'; msg.textContent = userName + ' added as present.'; }
        sel.value = '';
        setTimeout(function () { if (msg) msg.style.display = 'none'; }, 3000);
        // Reload from DB to get the canonical list
        loadAttendees();
      });
    }

    function validatePairForm() { var ok = document.getElementById('pc').value && document.getElementById('pk').value; document.getElementById('btn-create-pair-normal').disabled = !ok; }
    function validatePairFormRC() { var ok = document.getElementById('rc-pc').value && document.getElementById('rc-pk').value; document.getElementById('btn-create-pair-rc').disabled = !ok; }
    function renderPairBanner() { document.getElementById('pair-banner').style.display = 'none'; }
    function toggleAddPair() { var f = document.getElementById('add-pair-form'); f.style.display = f.style.display === 'none' ? '' : 'none'; if (f.style.display === 'none') { ['pc', 'pk', 'rc-pc', 'rc-pk'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; }); var rcWh = document.getElementById('rc-warehouse'); if (rcWh) Array.from(rcWh.options).forEach(function (o) { o.selected = false; }); document.getElementById('rc-role').value = 'User'; document.getElementById('btn-create-pair-normal').disabled = true; document.getElementById('btn-create-pair-rc').disabled = true; } else { refreshPairFormDropdowns(); } }
    function refreshPairFormDropdowns() {
      var assigned = new Set(); state.pairs.forEach(function (p) { assigned.add(p.c); assigned.add(p.k); });
      var available = usersList.filter(function (u) { return !assigned.has(u.name); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      var opts = available.map(function (u) { return '<option>' + u.name + '</option>'; }).join('');
      ['#pc', '#pk', '#rc-pc', '#rc-pk'].forEach(function (sel) { var el = document.querySelector(sel); if (!el) return; el.innerHTML = '<option value="">Select\u2026</option>' + opts; });
    }
    function createPair() { var rc = isRC(); var ini = function (n) { return n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }; var newId = 'P' + Date.now().toString(36).slice(-5).toUpperCase(); var newPair; if (rc) { var c = document.getElementById('rc-pc').value, k = document.getElementById('rc-pk').value, role = document.getElementById('rc-role').value; var whSel = document.getElementById('rc-warehouse'); var warehouse = Array.from(whSel.selectedOptions).map(function (o) { return o.value; }).filter(function (v) { return v && v !== '— none —'; }).join(',') || '—'; if (!c || !k) return; newPair = { id: newId, c: c, ci: ini(c), ca: false, k: k, ki: ini(k), ka: false, warehouse: warehouse, role: role, prog: 0 }; } else { var c2 = document.getElementById('pc').value, k2 = document.getElementById('pk').value; if (!c2 || !k2) return; newPair = { id: newId, c: c2, ci: ini(c2), ca: false, k: k2, ki: ini(k2), ka: false, warehouse: '—', role: 'User', prog: 0 }; } state.pairs.push(newPair); sb.from('pairs').insert({ id: newPair.id, session_id: state.curSessId, counter_name: newPair.c, checker_name: newPair.k, warehouse_id: newPair.warehouse !== '—' ? newPair.warehouse : null, role: newPair.role, counter_absent: false, checker_absent: false, progress: 0 }).then(function (res) { if (res.error) alert('Failed to save pair: ' + res.error.message); }); document.getElementById('add-pair-form').style.display = 'none'; renderPairs(); }
    function renderPairs() {
      var banner = document.getElementById('absent-banner');
      if (banner) {
        if (attendees.length > 0 && state.pairs.length > 0) {
          var notInAtt = [];
          state.pairs.forEach(function(p) {
            if (!attendees.find(function(a) { return a.name === p.c; })) notInAtt.push(p.c);
            if (!attendees.find(function(a) { return a.name === p.k; })) notInAtt.push(p.k);
          });
          notInAtt = notInAtt.filter(function(n, i, arr) { return arr.indexOf(n) === i; });
          if (notInAtt.length) {
            banner.style.display = '';
            banner.innerHTML = '<div class="banner bn-warn" style="margin-bottom:0;">&#9888; ' + notInAtt.length + ' pair member' + (notInAtt.length > 1 ? 's are' : ' is') + ' not in the attendance list and will be marked absent: <strong>' + notInAtt.join(', ') + '</strong></div>';
          } else { banner.style.display = 'none'; }
        } else { banner.style.display = 'none'; }
      }
      var grid = document.getElementById('pair-grid'); grid.innerHTML = ''; var rc = isRC(); state.pairs.forEach(function (p) { var abs = p.ca || p.ka; var div = document.createElement('div'); div.className = 'pcard' + (abs ? ' absent-border' : ''); div.onclick = function (e) { if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return; if (rc) { openDrawer(p.id); } else { openEditPair(p.id); } }; var at = function (a) { return a ? '<span class="abs-tag">Absent</span>' : ''; }; var roleHtml = rc ? '<div style="margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span style="font-size:11px;color:#666;">Role:</span><span class="role-badge ' + (p.role === 'Admin' ? 'role-admin' : 'role-user') + '">' + p.role + '</span></div>' : ''; var binHtml = rc ? '<div style="margin-bottom:8px;font-size:11px;"><span style="color:#666;">Bin: </span><span style="font-family:monospace;">' + p.warehouse + '</span></div>' : ''; var itemCountHtml = ''; var editBinBtn = rc ? '<button class="btn btn-sm" onclick="openEditPair(\'' + p.id + '\')">Edit pair</button>' : ''; var pairNum = state.pairs.indexOf(p) + 1; div.innerHTML = '<div style="font-size:10px;font-weight:700;color:#1b3764;opacity:0.55;text-transform:uppercase;letter-spacing:.06em;margin-bottom:9px;">Pair ' + pairNum + '</div><div style="display:flex;flex-direction:column;gap:7px;margin-bottom:11px;"><div style="display:flex;align-items:center;gap:8px;"><div class="av ' + (p.ca ? 'av-a' : 'av-n') + '">' + p.ci + '</div><div><div class="pname' + (p.ca ? ' abs' : '') + '">' + p.c + at(p.ca) + '</div><div style="font-size:11px;color:#666;">Counter</div></div></div><div style="display:flex;align-items:center;gap:8px;"><div class="av ' + (p.ka ? 'av-a' : 'av-n') + '">' + p.ki + '</div><div><div class="pname' + (p.ka ? ' abs' : '') + '">' + p.k + at(p.ka) + '</div><div style="font-size:11px;color:#666;">Checker</div></div></div></div><div style="border-top:1px solid #e2e8f0;padding-top:9px;">' + roleHtml + binHtml + '<div style="display:flex;align-items:center;justify-content:space-between;">' + (rc ? '<div style="display:flex;align-items:center;gap:3px;"><div class="prog-bar"><div class="prog-fill" style="width:' + p.prog + '%;' + (p.prog > 85 ? 'background:#1D9E75;' : '') + '"></div></div><span style="font-size:11px;color:#666;">' + p.prog + '%</span></div>' : '') + '</div><div style="display:flex;gap:5px;margin-top:7px;">' + editBinBtn + '</div></div>'; grid.appendChild(div); });
      // Add-pair card (same size as pair cards, at the end of the grid)
      var addCard = document.createElement('div');
      addCard.className = 'pcard';
      addCard.style.cssText = 'border-left-color:#cbd5e1;border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#94a3b8;min-height:120px;';
      addCard.onclick = function () { toggleAddPair(); addCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
      addCard.innerHTML = '<div style="width:36px;height:36px;border-radius:50%;border:2px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;color:#94a3b8;">+</div><div style="font-size:12px;font-weight:500;">Add pair</div>';
      grid.appendChild(addCard);
    }
    function openDrawer(pid) { state.openPairId = pid; var p = state.pairs.find(function (x) { return x.id === pid; }); document.getElementById('drw-title').textContent = 'Items — ' + p.c + ' / ' + p.k; document.getElementById('drw-search').value = ''; document.getElementById('drw-filter').value = 'all'; renderDrawer(); document.getElementById('pair-drawer').style.display = ''; document.getElementById('pair-drawer').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    function closeDrawer() { document.getElementById('pair-drawer').style.display = 'none'; state.openPairId = null; }
    function renderDrawer() { if (!state.openPairId) return; var s = document.getElementById('drw-search').value.toLowerCase(), f = document.getElementById('drw-filter').value; var tb = document.getElementById('drw-tbody'); tb.innerHTML = ''; var sub = state.items.filter(function (i) { if (i.pairId !== state.openPairId) return false; if (f === 'active' && i.dropped) return false; if (f === 'dropped' && !i.dropped) return false; if (s && !i.code.toLowerCase().includes(s) && !i.name.toLowerCase().includes(s)) return false; return true; }); document.getElementById('drw-sub').textContent = sub.length + ' item' + (sub.length !== 1 ? 's' : ''); if (!sub.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:14px;color:#666;">No items</td></tr>'; return; } sub.forEach(function (i) { var tr = document.createElement('tr'); if (i.dropped) tr.style.opacity = '.45'; tr.innerHTML = '<td style="font-family:monospace;font-size:11px;">' + i.code + '</td><td>' + i.name + '</td><td>' + i.grp + '</td><td style="font-size:11px;">' + i.batch + '</td><td>' + i.uom + '</td><td style="font-family:monospace;font-size:11px;">' + i.warehouse + '</td><td><span class="badge ' + (i.dropped ? 'is-drop' : 'is-active') + '">' + (i.dropped ? 'Dropped' : 'Active') + '</span></td>'; tb.appendChild(tr); }); }
    function openRepair(pid) { state.repairPairId = pid; state.repReplName = null; state.repReplInit = null; var p = state.pairs.find(function (x) { return x.id === pid; }); var absPerson = p.ca ? p.c : p.k, role = p.ca ? 'counter' : 'checker'; document.getElementById('rep-title').textContent = 'Replace ' + role + ' — Pair ' + pid; document.getElementById('rep-sub').textContent = absPerson + ' is absent. Select a replacement:'; document.getElementById('rep-confirm').disabled = true; var list = document.getElementById('rep-list'); list.innerHTML = ''; var repUsers = usersList.filter(function (u) { return u.name !== absPerson; }); if (!repUsers.length) { list.innerHTML = '<div style="font-size:12px;color:#666;padding:8px;">No users available. Import users first.</div>'; } repUsers.forEach(function (u) { var d = document.createElement('div'); d.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;border:.5px solid transparent;margin-bottom:4px;'; d.innerHTML = '<div class="av av-n">' + u.initials + '</div><div><div style="font-size:12px;font-weight:500;">' + u.name + '</div><div style="font-size:11px;color:#666;">Available</div></div>'; d.onclick = function () { document.querySelectorAll('#rep-list > div').forEach(function (x) { x.style.borderColor = 'transparent'; x.style.background = ''; }); d.style.borderColor = '#1b3764'; d.style.background = '#e8f4fd'; state.repReplName = u.name; state.repReplInit = u.initials; document.getElementById('rep-confirm').disabled = false; }; list.appendChild(d); }); document.getElementById('pair-drawer').style.display = 'none'; document.getElementById('repair-wrap').style.display = ''; }
    function confirmRepair() { var p = state.pairs.find(function (x) { return x.id === state.repairPairId; }); if (p.ca) { p.c = state.repReplName; p.ci = state.repReplInit; p.ca = false; } else { p.k = state.repReplName; p.ki = state.repReplInit; p.ka = false; } sb.from('pairs').update({ counter_name: p.c, checker_name: p.k, counter_absent: false, checker_absent: false }).eq('id', p.id).then(function (r) { if (r.error) alert('Failed to save replacement: ' + r.error.message); }); document.getElementById('repair-wrap').style.display = 'none'; renderPairs(); renderItems(); }
    function closeRepair() { document.getElementById('repair-wrap').style.display = 'none'; }
    function openEditWarehouse(pid) { state.editWarehousePairId = pid; var p = state.pairs.find(function (x) { return x.id === pid; }); document.getElementById('ewarehouse-title').textContent = 'Edit bin — Pair ' + pid; document.getElementById('ewarehouse-sub').textContent = p.c + ' / ' + p.k; var sel = document.getElementById('ewarehouse-sel'); var current = p.warehouse && p.warehouse !== '—' ? p.warehouse.split(',') : []; Array.from(sel.options).forEach(function (o) { o.selected = current.indexOf(o.value) !== -1; }); document.getElementById('pair-drawer').style.display = 'none'; document.getElementById('editwarehouse-wrap').style.display = ''; }
    function saveEditWarehouse() { var p = state.pairs.find(function (x) { return x.id === state.editWarehousePairId; }); var sel = document.getElementById('ewarehouse-sel'); var v = Array.from(sel.selectedOptions).map(function (o) { return o.value; }).filter(function (x) { return x && x !== '— none —'; }).join(','); p.warehouse = v || '—'; sb.from('pairs').update({ warehouse_id: v || null }).eq('id', p.id).then(function (r) { if (r.error) console.error(r.error); }); document.getElementById('editwarehouse-wrap').style.display = 'none'; renderPairs(); }
    function closeEditWarehouse() { document.getElementById('editwarehouse-wrap').style.display = 'none'; }
    function openEditPair(pid) {
      state.editPairId = pid;
      var p = state.pairs.find(function (x) { return x.id === pid; });
      var rc = isRC();
      document.getElementById('epr-title').textContent = 'Edit Pair — ' + p.c + ' / ' + p.k;
      var source = usersList.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      var opts = source.map(function (u) { return '<option>' + u.name + '</option>'; }).join('');
      var cs = document.getElementById('epr-counter'), ks = document.getElementById('epr-checker');
      cs.innerHTML = '<option value="">\u2026</option>' + opts;
      ks.innerHTML = '<option value="">\u2026</option>' + opts;
      cs.value = p.c; ks.value = p.k;
      // Bin section — recount only
      var binWrap = document.getElementById('epr-bin-wrap');
      binWrap.style.display = rc ? '' : 'none';
      if (rc) {
        var binSel = document.getElementById('epr-bin');
        var current = p.warehouse && p.warehouse !== '\u2014' ? p.warehouse.split(',') : [];
        Array.from(binSel.options).forEach(function (o) { o.selected = current.indexOf(o.value) !== -1; });
      }
      document.getElementById('epr-save').disabled = false;
      document.getElementById('edit-pair-wrap').style.display = '';
    }
    function validateEditPair() { var ok = document.getElementById('epr-counter').value && document.getElementById('epr-checker').value; document.getElementById('epr-save').disabled = !ok; }
    function saveEditPair() {
      var p = state.pairs.find(function (x) { return x.id === state.editPairId; });
      var c = document.getElementById('epr-counter').value, k = document.getElementById('epr-checker').value;
      if (!c || !k) return;
      var ini = function (n) { return n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); };
      p.c = c; p.ci = ini(c); p.ca = false; p.k = k; p.ki = ini(k); p.ka = false;
      var update = { counter_name: c, checker_name: k, counter_absent: false, checker_absent: false };
      if (isRC()) {
        var binSel = document.getElementById('epr-bin');
        var binVal = Array.from(binSel.selectedOptions).map(function (o) { return o.value; }).filter(function (v) { return !!v; }).join(',');
        p.warehouse = binVal || '\u2014';
        update.warehouse_id = binVal || null;
      }
      sb.from('pairs').update(update).eq('id', state.editPairId).then(function (res) { if (res.error) alert('Failed to update pair: ' + res.error.message); });
      document.getElementById('edit-pair-wrap').style.display = 'none';
      renderPairs();
      if (!isRC()) crossCheckPairsAttendance();
    }
    function deletePair() { if (!confirm('Delete Pair ' + state.editPairId + '? This cannot be undone.')) return; state.pairs = state.pairs.filter(function (p) { return p.id !== state.editPairId; }); sb.from('pairs').delete().eq('id', state.editPairId).then(function (res) { if (res.error) alert('Failed to delete pair: ' + res.error.message); }); document.getElementById('edit-pair-wrap').style.display = 'none'; renderPairs(); }
    function closeEditPair() { document.getElementById('edit-pair-wrap').style.display = 'none'; }
    function pairOpts() { return state.pairs.map(function (p) { return '<option value="' + p.id + '">' + p.c + ' / ' + p.k + '</option>'; }).join(''); }
    function populateItemFilters() { var grps = [], whs = []; state.items.forEach(function (i) { if (i.grp && grps.indexOf(i.grp) === -1) grps.push(i.grp); var w = i.wh; if (w && whs.indexOf(w) === -1) whs.push(w); }); grps.sort(); whs.sort(); var gs = document.getElementById('item-grp-filter'), ws = document.getElementById('item-wh-filter'); if (!gs) return; var cg = gs.value, cw = ws.value; gs.innerHTML = '<option value="">All groups</option>' + grps.map(function (g) { return '<option>' + g + '</option>'; }).join(''); ws.innerHTML = '<option value="">All warehouses</option>' + whs.map(function (w) { return '<option>' + w + '</option>'; }).join(''); if (cg) gs.value = cg; if (cw) ws.value = cw; }
    function renderItems(filter, search) {
      state.lastCheckedRow = null; filter = filter || document.getElementById('item-status-filter').value || 'all'; search = (typeof search === 'string' ? search : '').toLowerCase(); var grp = document.getElementById('item-grp-filter').value; var wh = document.getElementById('item-wh-filter').value; var entity = cs() ? cs().entity : ''; var rc = isRC(); document.getElementById('col-pair').style.display = rc ? '' : 'none'; document.getElementById('col-src').style.display = ''; var sapBtn = document.getElementById('btn-import-sap'); if (sapBtn) sapBtn.style.display = rc ? 'none' : ''; var tb = document.getElementById('items-tbody'); tb.innerHTML = ''; var filtered = state.items.filter(function (i) { var mf = filter === 'all' || (filter === 'active' && !i.dropped) || (filter === 'dropped' && i.dropped) || (filter === 'matched' && i.itemStatus === 'Matched') || (filter === 'variance' && i.itemStatus === 'Variance') || (filter === 'new_item' && i.itemStatus === 'New item'); var ms = !search || i.code.toLowerCase().includes(search) || i.name.toLowerCase().includes(search) || (i.batch && i.batch !== '—' && i.batch.toLowerCase().includes(search)); var mg = !grp || i.grp === grp; var mw = !wh || i.wh === wh; var me = !entity || i.entity === entity; return mf && ms && mg && mw && me; }); state._filteredItems = filtered;
      if (state._sortCol && state._sortKeyMap[state._sortCol]) { var _sk = state._sortKeyMap[state._sortCol]; filtered = filtered.slice().sort(function(a,b){ var av=a[_sk], bv=b[_sk]; if(av===null||av===undefined)av=''; if(bv===null||bv===undefined)bv=''; return(typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true}))*state._sortDir; }); }
      var totalPages = Math.ceil(filtered.length / state._itemsPerPage) || 1; if (state._itemPage >= totalPages) state._itemPage = totalPages - 1; if (state._itemPage < 0) state._itemPage = 0; var pageItems = filtered.slice(state._itemPage * state._itemsPerPage, (state._itemPage + 1) * state._itemsPerPage); var subEl = document.getElementById('items-sub'); if (subEl) { subEl.textContent = 'Showing ' + filtered.length + ' items' + (totalPages > 1 ? ' · page ' + (state._itemPage + 1) + '/' + totalPages : ''); } var selAllBtn = document.getElementById('btn-sel-all'); if (selAllBtn) { selAllBtn.textContent = 'Select all ' + filtered.length; } var pager = document.getElementById('items-pager'); if (pager) { if (totalPages > 1) { pager.style.display = 'flex'; document.getElementById('items-pager-info').textContent = (state._itemPage * state._itemsPerPage + 1) + '–' + Math.min((state._itemPage + 1) * state._itemsPerPage, filtered.length) + ' of ' + filtered.length + ' items'; document.getElementById('items-pager-prev').disabled = state._itemPage === 0; document.getElementById('items-pager-next').disabled = state._itemPage >= totalPages - 1; } else { pager.style.display = 'none'; } } pageItems.forEach(function (item) {
        var tr = document.createElement('tr'); if (item.dropped) tr.style.opacity = '.45';
        var pcell = rc ? '<td><select class="select" style="font-size:11px;padding:3px 7px;width:auto;" onchange="changeItemPair(\'' + item.id + '\',this.value)"><option value=""></option>' + pairOpts().replace('value="' + (item.pairId || '') + '"', 'value="' + (item.pairId || '') + '" selected') + '</select></td>' : '';
        var statusBadgeClass = item.itemStatus === 'New item' ? 'b-purple' : item.itemStatus === 'Not found' ? 'b-danger' : item.itemStatus === 'Matched' ? 'b-success' : 'b-warn';
        var srcCell = '<td>' + (item.itemStatus ? '<span class="badge ' + statusBadgeClass + '">' + item.itemStatus + '</span>' : '<span style="color:#aaa;font-size:11px;">\u2014</span>') + '</td>';
        var pairName = (rc && (item.cnt === null || item.cnt === undefined)) ? '\u2014' : (item.pairId ? (function(){ var p = state.pairs.find(function(x){ return x.id === item.pairId; }); return p ? p.c + ' / ' + p.k : (item.assignedTo || '\u2014'); })() : (item.assignedTo || '\u2014'));
        var photoBtn = item.photos && item.photos.length ? '<button class="photo-link-btn" onclick="openPhotoGallery(\'' + item.id + '\')">&#128247; ' + item.photos.length + '</button>' : '<span style="color:#aaa;font-size:11px;">\u2014</span>';
        var p1 = rc ? (_parentItems[item.code] || null) : null;
        var p1Cells = rc ? ('<td style="font-family:monospace;font-size:11px;">' + (p1 && p1.cnt !== null && p1.cnt !== undefined ? p1.cnt : '\u2014') + '</td><td style="font-size:11px;">' + (p1 && p1.by ? p1.by : '\u2014') + '</td><td style="font-family:monospace;font-size:11px;">' + (p1 && p1.bin ? p1.bin : '\u2014') + '</td>') : '';
        var _rem = item.remark || '';
        var remarkCell = '<td style="font-size:11px;color:var(--text-2);max-width:140px;">'
          + (_rem.length === 0 ? '<span style="color:#aaa;">\u2014</span>'
            : _rem.length <= 20 ? _rem
            : '<span style="cursor:pointer;color:var(--primary);text-decoration:underline dotted;" data-remark="' + _rem.replace(/"/g,'&quot;') + '" onclick="showRemarkPopup(this.dataset.remark)">' + _rem.slice(0, 20) + '\u2026</span>')
          + '</td>';
        tr.innerHTML = '<td><input type="checkbox" data-id="' + item.id + '"' + (state.selItems.has(item.id) ? ' checked' : '') + ' onclick="rowCheckClick(event,this)"/></td><td style="font-family:monospace;font-size:11px;">' + item.code + '</td><td>' + item.name + '</td><td>' + item.grp + '</td><td style="font-size:11px;">' + item.batch + '</td><td>' + item.uom + '</td>' + '<td style="font-size:11px;">' + (item.pkg || '\u2014') + '</td>' + '<td style="font-size:11px;">' + (item.expiry || '\u2014') + '</td>' + '<td style="font-size:11px;">' + (item.category || '\u2014') + '</td>' + '<td style="font-family:monospace;">' + item.sap + '</td>' + '<td>' + (item.cnt !== null && item.cnt !== undefined ? '<span class="qty-counted">' + item.cnt + '</span>' : '<span class="qty-null">—</span>') + '</td>' + '<td>' + (item.dmg !== null && item.dmg !== undefined ? '<span class="qty-dmg">' + item.dmg + '</span>' : '<span class="qty-null">—</span>') + '</td>' + '<td>' + (item.expQty !== null && item.expQty !== undefined ? '<span class="qty-exp">' + item.expQty + '</span>' : '<span class="qty-null">—</span>') + '</td>' + '<td style="font-size:11px;">' + pairName + '</td>' + '<td style="font-family:monospace;font-size:11px;color:var(--text-2);">' + (item.wh || '\u2014') + '</td>' + '<td style="font-family:monospace;font-size:11px;">' + item.warehouse + '</td>' + remarkCell + '<td>' + photoBtn + '</td>' + pcell + srcCell + p1Cells + '<td><span class="badge ' + (item.dropped ? 'is-drop' : 'is-active') + '">' + (item.dropped ? 'Dropped' : 'Active') + '</span></td><td>' + (item.dropped ? '<button class="btn btn-sm rec-btn" onclick="toggleItem(\'' + item.id + '\')">Recover</button>' : '<button class="btn btn-sm drop-btn" onclick="toggleItem(\'' + item.id + '\')">Drop</button>') + '</td>'; tb.appendChild(tr);
      }); updateSel(); applyItemColVisibility(); applyColOrder(); updateSortIndicators();
      var baw = document.getElementById('bulk-assign-wrap');
      if (baw) { baw.style.display = rc ? 'flex' : 'none'; if (rc) renderBulkPairs(); }
    }
    function changeItemPair(id, pid) {
      var i = state.items.find(function (x) { return x.id === id; });
      if (!i) return;
      i.pairId = pid || null;
      var p = pid ? state.pairs.find(function (x) { return x.id === pid; }) : null;
      i.assignedTo = p ? (p.c + ' / ' + p.k) : null;
      sb.from('items').update({ pair_id: pid || null, assigned_to: i.assignedTo }).eq('id', id).then(function (res) {
        if (res.error) console.error('Failed to update pair:', res.error.message);
      });
    }
    function showItemToast(msg, type) {
      var t = document.getElementById('item-toast');
      if (!t) return;
      t.textContent = msg;
      t.className = 't-' + (type || 'success');
      t.style.display = 'block';
      clearTimeout(t._tid);
      t._tid = setTimeout(function () { t.style.display = 'none'; }, 4000);
    }
    function toggleItem(id) {
      var i = state.items.find(function (x) { return x.id === id; });
      if (i) {
        i.dropped = !i.dropped;
        var action = i.dropped ? 'dropped' : 'recovered';
        sb.from('items').update({ dropped: i.dropped }).eq('id', id).then(function (res) {
          if (res.error) { showItemToast('Sync failed: ' + res.error.message, 'error'); }
          else { showItemToast('1 item ' + action, 'success'); }
        });
      }
      renderItems(); if (state.openPairId) renderDrawer();
    }
    function filterItems(v) { state._itemPage = 0; renderItems(document.getElementById('item-status-filter').value, typeof v === 'string' ? v : (document.getElementById('item-search-input') ? document.getElementById('item-search-input').value : '')); }
    function itemPageNav(dir) { state._itemPage += dir; renderItems(); }
    function rowCheckClick(e, cb) {
      var boxes = Array.from(document.querySelectorAll('#items-tbody input[type=checkbox]'));
      if (e.shiftKey && state.lastCheckedRow) {
        var a = boxes.indexOf(state.lastCheckedRow), b = boxes.indexOf(cb);
        if (a !== -1 && b !== -1) {
          var lo = Math.min(a, b), hi = Math.max(a, b);
          boxes.slice(lo, hi + 1).forEach(function (box) { box.checked = cb.checked; });
        }
      }
      state.lastCheckedRow = cb;
      updateSel();
    }
    function updateSel() {
      // Sync only current page's checkboxes — preserve selections from other pages
      document.querySelectorAll('#items-tbody input[type=checkbox]').forEach(function (cb) {
        if (cb.checked) state.selItems.add(cb.dataset.id);
        else state.selItems.delete(cb.dataset.id);
      });
      var bar = document.getElementById('bulk-bar'); bar.style.display = state.selItems.size ? 'flex' : 'none';
      document.getElementById('sel-lbl').textContent = state.selItems.size + ' selected';
    }
    function toggleAllItems(cb) { if (cb.checked) { state._filteredItems.forEach(function(i) { state.selItems.add(i.id); }); } else { state.selItems.clear(); } renderItems(); }
    function selectAllFiltered() { state._filteredItems.forEach(function(i) { state.selItems.add(i.id); }); renderItems(); }
    function clearSel() { state.selItems.clear(); renderItems(); }
    function bulkDrop() {
      var ids = Array.from(state.selItems); var count = ids.length;
      if (!count) return;
      ids.forEach(function (id) { var i = state.items.find(function (x) { return x.id === id; }); if (i) i.dropped = true; });
      state.selItems.clear(); renderItems();
      Promise.all(ids.map(function (id) { return sb.from('items').update({ dropped: true }).eq('id', id); }))
        .then(function (results) {
          var err = results.find(function (r) { return r.error; });
          if (err) { showItemToast('Sync failed: ' + err.error.message, 'error'); }
          else { showItemToast(count + ' item' + (count === 1 ? '' : 's') + ' dropped', 'success'); }
        });
    }
    function bulkRecover() {
      var ids = Array.from(state.selItems); var count = ids.length;
      if (!count) return;
      ids.forEach(function (id) { var i = state.items.find(function (x) { return x.id === id; }); if (i) i.dropped = false; });
      state.selItems.clear(); renderItems();
      Promise.all(ids.map(function (id) { return sb.from('items').update({ dropped: false }).eq('id', id); }))
        .then(function (results) {
          var err = results.find(function (r) { return r.error; });
          if (err) { showItemToast('Sync failed: ' + err.error.message, 'error'); }
          else { showItemToast(count + ' item' + (count === 1 ? '' : 's') + ' recovered', 'success'); }
        });
    }
    function buildDashboard() {
      var entity = cs() ? cs().entity : '';
      var active = state.items.filter(function (i) { return !i.dropped && (!entity || i.entity === entity); });
      var counted = active.filter(function (i) { return i.cnt !== null && i.cnt !== undefined && i.cnt !== ''; });
      var total = active.length, cntCount = counted.length;
      var pct = total ? Math.round(cntCount / total * 100) : 0;
      var newFiltered = active.filter(function (i) { return i.newItem === 'Yes'; });
      document.getElementById('db-total').textContent = total;
      document.getElementById('db-counted').textContent = cntCount + ' / ' + total;
      document.getElementById('db-pct').textContent = pct + '%';
      document.getElementById('db-pending').textContent = total - cntCount;
      document.getElementById('db-new').textContent = newFiltered.length;
      // Animate donut ring: circumference = 2*π*33 ≈ 207.3
      var circ = 207.3, fill = pct / 100 * circ;
      var ring = document.getElementById('db-ring-fill');
      if (ring) {
        ring.setAttribute('stroke-dasharray', fill.toFixed(1) + ' ' + circ);
        ring.setAttribute('stroke', pct === 100 ? '#4ade80' : pct >= 60 ? '#60a5fa' : pct >= 30 ? '#f59e0b' : '#f87171');
      }
      function makeRows(map, tbodyId, type) {
        var tb = document.getElementById(tbodyId); tb.innerHTML = '';
        var keys = Object.keys(map).sort();
        keys.forEach(function (key) {
          var d = map[key], p = d.total ? Math.round(d.counted / d.total * 100) : 0;
          var barColor = p === 100 ? '#10b981' : p >= 60 ? '#3b82f6' : p >= 30 ? '#f59e0b' : '#f87171';
          var tr = document.createElement('tr');
          tr.className = 'db-breakdown-row';
          tr.title = 'Click to view items';
          var keyDisplay = key === '—' ? '<span style="color:#aaa;font-style:italic;">Unassigned</span>' : key;
          tr.innerHTML = '<td style="font-weight:500;">' + keyDisplay + '</td>'
            + '<td style="text-align:right;color:var(--text-2);">' + d.total + '</td>'
            + '<td style="text-align:right;color:var(--text-2);">' + d.counted + '</td>'
            + '<td><div style="display:flex;align-items:center;gap:6px;">'
            + '<div style="flex:1;height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden;min-width:55px;">'
            + '<div style="width:' + p + '%;height:100%;background:' + barColor + ';border-radius:3px;transition:width 0.5s ease;"></div></div>'
            + '<span style="font-size:11px;font-weight:700;color:' + barColor + ';min-width:32px;text-align:right;">' + p + '%</span>'
            + '</div></td>';
          tr.onclick = (function (k) { return function () { openDrilldown(type, k); }; })(key);
          tb.appendChild(tr);
        });
        if (!keys.length) tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:14px;font-size:12px;">No data</td></tr>';
      }
      var grpMap = {}, whMap = {};
      active.forEach(function (i) {
        var g = i.grp || '—';
        if (!grpMap[g]) grpMap[g] = { total: 0, counted: 0 };
        grpMap[g].total++;
        if (i.cnt !== null && i.cnt !== undefined && i.cnt !== '') grpMap[g].counted++;
        var w = i.wh || i.warehouse || '—';
        if (!whMap[w]) whMap[w] = { total: 0, counted: 0 };
        whMap[w].total++;
        if (i.cnt !== null && i.cnt !== undefined && i.cnt !== '') whMap[w].counted++;
      });
      makeRows(grpMap, 'db-grp-tbody', 'group');
      makeRows(whMap, 'db-wh-tbody', 'warehouse');
    }
    var _ddItems = [], _ddTitle = '';
    function openDrilldown(type, key) {
      var entity = cs() ? cs().entity : '';
      var active = state.items.filter(function (i) { return !i.dropped && (!entity || i.entity === entity); });
      var filtered = active.filter(function (i) {
        if (type === 'group') return (i.grp || '—') === key;
        if (type === 'warehouse') return (i.wh || i.warehouse || '—') === key;
        return true;
      });
      filtered = filtered.slice().sort(function (a, b) {
        var aCounted = a.cnt !== null && a.cnt !== undefined && a.cnt !== '';
        var bCounted = b.cnt !== null && b.cnt !== undefined && b.cnt !== '';
        if (aCounted !== bCounted) return aCounted ? 1 : -1;
        return (a.name || '').localeCompare(b.name || '');
      });
      _ddItems = filtered;
      var label = key === '—' ? 'Unassigned' : key;
      _ddTitle = (type === 'group' ? 'Item Group' : 'Warehouse') + ' — ' + label;
      drilldownTab('pending');
      document.getElementById('drilldown-wrap').style.display = '';
    }
    function drilldownTab(mode) {
      ['pending','counted','all'].forEach(function(m) {
        var btn = document.getElementById('dd-tab-' + m);
        if (btn) { btn.className = 'btn btn-sm' + (m === mode ? ' btn-primary' : ''); }
      });
      var list = _ddItems.filter(function(i) {
        var hasCnt = i.cnt !== null && i.cnt !== undefined && i.cnt !== '';
        if (mode === 'pending') return !hasCnt;
        if (mode === 'counted') return hasCnt;
        return true;
      });
      document.getElementById('drilldown-title').textContent = _ddTitle + ' — ' + list.length + ' ' + (mode === 'all' ? 'total' : mode);
      var rows = list.map(function (i) {
        var hasCnt = i.cnt !== null && i.cnt !== undefined && i.cnt !== '';
        var hasVar = hasCnt && i.variance && Math.abs(parseFloat(i.variance)) > 0;
        var sc = hasCnt ? (hasVar ? 'b-warn' : 'b-success') : 'b-danger';
        var st = hasCnt ? (hasVar ? 'Variance' : 'Counted') : 'Pending';
        return '<tr>'
          + '<td style="font-family:monospace;font-size:11px;">' + (i.code || '—') + '</td>'
          + '<td>' + (i.name || '—') + '</td>'
          + '<td style="font-family:monospace;font-size:11px;color:var(--text-2);">' + (i.batch && i.batch !== '—' ? i.batch : '—') + '</td>'
          + '<td style="font-size:11px;color:var(--text-2);">' + (i.wh || i.warehouse || '—') + '</td>'
          + '<td style="text-align:right;">' + (i.sap !== null && i.sap !== undefined ? i.sap : '—') + '</td>'
          + '<td style="text-align:right;font-weight:' + (hasCnt ? '600' : '400') + ';">' + (hasCnt ? i.cnt : '—') + '</td>'
          + '<td><span class="badge ' + sc + '">' + st + '</span></td>'
          + '</tr>';
      }).join('');
      document.getElementById('drilldown-body').innerHTML =
        '<table class="tbl" style="min-width:580px;"><thead><tr>'
        + '<th>Code</th><th>Name</th><th>Batch</th><th>Warehouse</th>'
        + '<th style="text-align:right;">SAP Qty</th><th style="text-align:right;">Count Qty</th><th>Status</th>'
        + '</tr></thead><tbody>'
        + (rows || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:14px;">No items</td></tr>')
        + '</tbody></table>';
    }
    function closeDrilldown() { document.getElementById('drilldown-wrap').style.display = 'none'; }
    function showRemarkPopup(text) {
      var wrap = document.getElementById('remark-popup-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'remark-popup-wrap';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,0.45);display:flex;align-items:center;justify-content:center;padding:20px;';
        wrap.innerHTML = '<div style="background:#fff;border-radius:12px;padding:20px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.18);">'
          + '<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.11em;margin-bottom:10px;">Remark</div>'
          + '<div id="remark-popup-text" style="font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-wrap;word-break:break-word;"></div>'
          + '<button class="btn" style="margin-top:16px;width:100%;" onclick="document.getElementById(\'remark-popup-wrap\').style.display=\'none\'">Close</button>'
          + '</div>';
        wrap.addEventListener('click', function(e) { if (e.target === wrap) wrap.style.display = 'none'; });
        document.body.appendChild(wrap);
      }
      document.getElementById('remark-popup-text').textContent = text;
      wrap.style.display = 'flex';
    }
    function renderGallery() {
      var grid = document.getElementById('gallery-grid'); grid.innerHTML = '';
      var icons = ['&#128230;', '&#128295;', '&#129524;'];
      var niItems = state.items.filter(function(i) { return i.newItem === 'Yes' && !i.dropped; });
      if (!niItems.length) {
        grid.innerHTML = '<div style="text-align:center;color:var(--text-3);font-size:13px;padding:32px;">No new items submitted yet.</div>';
        return;
      }
      niItems.forEach(function(n, idx) {
        var d = document.createElement('div'); d.className = 'card';
        var _pid = n.id;
        var photoHtml = (n.photos && n.photos.length)
          ? '<img src="' + n.photos[0] + '" onclick="openPhotoGallery(\'' + _pid + '\')" style="width:100%;border-radius:6px;aspect-ratio:4/3;object-fit:cover;margin-bottom:10px;cursor:pointer;" title="Click to view full image" />'
          : '<div style="background:#f5f5f5;border-radius:6px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:10px;">' + icons[idx % 3] + '</div>';
        d.style.padding = '8px';
        d.innerHTML = photoHtml
          + '<div style="font-size:11px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + (n.name || '') + '">' + (n.name || '—') + '</div>'
          + '<div style="font-size:10px;color:var(--text-2);font-family:monospace;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (n.code || '—') + (n.batch && n.batch !== '—' ? ' · ' + n.batch : '') + '</div>'
          + '<div style="font-size:10px;color:#666;margin-bottom:4px;">Qty: ' + (n.cnt !== null && n.cnt !== undefined ? n.cnt : '—') + ' · ' + (n.warehouse || '—') + '</div>'
          + ((n.submittedBy || n.assignedTo) ? '<div style="font-size:10px;color:var(--primary);margin-bottom:4px;">by ' + (n.submittedBy || n.assignedTo) + '</div>' : '')
          + '<span class="badge b-purple" style="font-size:9px;">New Item</span>';
        grid.appendChild(d);
      });
    }
    function setGalleryStatus(id, st) { var n = state.newItems.find(function (x) { return x.id === id; }); if (n) n.status = st; renderGallery(); }

    // ── Photo Lightbox ────────────────────────────────────────────────────────
    var _lightboxUrls = [], _lightboxIdx = 0;
    function openPhotoLightbox(urls, idx) {
      if (!urls || !urls.length) return;
      _lightboxUrls = urls; _lightboxIdx = idx || 0;
      var existing = document.getElementById('photo-lightbox');
      if (existing) existing.remove();
      var wrap = document.createElement('div');
      wrap.id = 'photo-lightbox';
      wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;';
      wrap.onclick = function(e) { if (e.target === wrap) closePhotoModal(); };
      wrap.innerHTML =
        '<button onclick="closePhotoModal()" style="position:absolute;top:16px;right:20px;background:none;border:none;color:#fff;font-size:28px;cursor:pointer;line-height:1;">&#10005;</button>' +
        '<button id="lb-prev" onclick="photoLightboxNav(-1)" style="position:absolute;left:16px;background:none;border:none;color:#fff;font-size:36px;cursor:pointer;line-height:1;">&#8249;</button>' +
        '<img id="lb-img" src="' + urls[_lightboxIdx] + '" style="max-width:92vw;max-height:88vh;border-radius:8px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,0.6);" />' +
        '<button id="lb-next" onclick="photoLightboxNav(1)" style="position:absolute;right:16px;background:none;border:none;color:#fff;font-size:36px;cursor:pointer;line-height:1;">&#8250;</button>' +
        '<div id="lb-counter" style="position:absolute;bottom:16px;color:rgba(255,255,255,0.7);font-size:13px;">' + (urls.length > 1 ? (1 + '/' + urls.length) : '') + '</div>';
      document.body.appendChild(wrap);
      _lightboxUpdateNav();
    }
    function _lightboxUpdateNav() {
      var prev = document.getElementById('lb-prev'); var next = document.getElementById('lb-next');
      var ctr = document.getElementById('lb-counter');
      if (prev) prev.style.display = _lightboxUrls.length > 1 ? '' : 'none';
      if (next) next.style.display = _lightboxUrls.length > 1 ? '' : 'none';
      if (ctr) ctr.textContent = _lightboxUrls.length > 1 ? (_lightboxIdx + 1) + '/' + _lightboxUrls.length : '';
    }
    function photoLightboxNav(dir) {
      _lightboxIdx = (_lightboxIdx + dir + _lightboxUrls.length) % _lightboxUrls.length;
      var img = document.getElementById('lb-img'); if (img) img.src = _lightboxUrls[_lightboxIdx];
      _lightboxUpdateNav();
    }






    var deleteSessId = null;








    var _parentItems = {}; // keyed by item code, value: { cnt, submittedBy, warehouse }

    function loadItems() {
      if (!state.curSessId) { renderItems(); buildDashboard(); return; }
      var sess = cs();
      var isRecount = !!(sess && sess.rc);
      var parentId = isRecount ? (sess.parentId || null) : null;

      function doFetch() {
        var allRows = [];
        function fetchPage(from) {
          sb.from('items')
            .select('id, code, name, count_qty, sap_qty, item_status, bin_location, damaged_qty, expired_qty, remark, batch, uom, new_item, pair_id, assigned_to, dropped, photos, group, entity, wh_code, submitted_by')
            .eq('session_id', state.curSessId)
            .order('created_at', { ascending: false })
            .range(from, from + 999)
            .then(function (res) {
            if (res.error) { console.error(res.error); state.items = allRows.map(mapItem); populateItemFilters(); renderItems(); buildDashboard(); return; }
            allRows = allRows.concat(res.data || []);
            if (res.data && res.data.length === 1000) { fetchPage(from + 1000); }
            else { state.items = allRows.map(mapItem); populateItemFilters(); renderItems(); buildDashboard(); renderGallery(); }
          });
        }
        fetchPage(0);
      }

      if (parentId) {
        // Fetch parent session items to show first-count data columns
        sb.from('items').select('code,count_qty,submitted_by,bin_location,assigned_to').eq('session_id', parentId).then(function(pRes) {
          _parentItems = {};
          if (!pRes.error && pRes.data) {
            pRes.data.forEach(function(pi) {
              if (pi.code) _parentItems[pi.code] = { cnt: pi.count_qty, by: pi.submitted_by || pi.assigned_to || null, bin: pi.bin_location || null };
            });
          }
          doFetch();
        });
      } else {
        _parentItems = {};
        doFetch();
      }
    }

    function applyBinOptions(bins) {
      // Filter: bins whose name contains "Singapore" are only shown for Singapore sessions
      var sessionCountry = (cs() && cs().country) ? cs().country.toLowerCase() : '';
      bins = bins.filter(function (b) {
        var label = ((b.name || '') + ' ' + (b.id || '')).toLowerCase();
        if (label.includes('singapore')) return sessionCountry.includes('singapore');
        return true;
      });
      // bins: array of { id: bin_location, name: location_assigned }, sorted by id
      var opts = bins.map(function (b) {
        var label = b.name && b.name !== b.id ? b.id + ' \u2014 ' + b.name : b.id;
        return '<option value="' + b.id + '">' + label + '</option>';
      }).join('');
      ['#rc-warehouse', '#ewarehouse-sel', '#epr-bin'].forEach(function (sel) {
        var el = document.querySelector(sel); if (!el) return;
        var selected = Array.from(el.selectedOptions).map(function (o) { return o.value; });
        el.innerHTML = opts;
        selected.forEach(function (v) { Array.from(el.options).forEach(function (o) { if (o.value === v) o.selected = true; }); });
      });
      // Feed the Scan & Count bin combobox
      binComboSetOptions(bins);
    }

    function loadWarehouses() {
      sb.from('warehouses').select('id,name').order('id', { ascending: true }).then(function (res) {
        if (!res.error && res.data && res.data.length) {
          // Supabase has bins — use them immediately
          applyBinOptions(res.data.map(function (r) { return { id: r.id, name: r.name || r.id }; }));
        } else {
          // Supabase empty — sync from webhook now
          syncBinsFromWebhook(null);
        }
      });
    }

    // Refresh the Supabase session before any admin DB write.
    // If the session is fully expired, show the login overlay and reject so callers stop.
    function requireFreshSession() {
      return sb.auth.refreshSession().then(function (res) {
        if (res.error || !res.data || !res.data.session) {
          showSsoOverlay();
          return Promise.reject(new Error('Session expired — please sign in again.'));
        }
      });
    }

    function syncBinsFromWebhook(btn) {
      if (btn) { btn.disabled = true; btn.textContent = '\u21bb Syncing\u2026'; }
      // Edge Function now handles the DB upsert with service role key
      fetch(FN_BASE + '/import-bins', { method: 'POST', headers: FN_HEADERS, body: '{}' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          var bins = (data.bins || []);
          if (!bins.length) return;
          applyBinOptions(bins);
          if (btn) { btn.disabled = false; btn.textContent = '\u21bb Refresh bins'; }
        })
        .catch(function (err) {
          console.error('syncBinsFromWebhook error:', err);
          if (btn) { btn.disabled = false; btn.textContent = '\u21bb Refresh bins'; }
        });
    }

    function populateUserDropdowns() {
      var opts = usersList.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (u) { return '<option>' + u.name + '</option>'; }).join('');
      ['#pc', '#pk', '#rc-pc', '#rc-pk'].forEach(function (sel) {
        var el = document.querySelector(sel); if (!el) return;
        el.innerHTML = '<option value="">Select\u2026</option>' + opts;
      });
    }

    function loadUsers() {
      sb.from('users').select('*').order('name', { ascending: true }).then(function (res) {
        if (res.error || !res.data || !res.data.length) return;
        usersList = res.data.map(function (u) {
          var n = u.name || u.display_name || String(u.id);
          var ini = u.initials || n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
          return { id: u.id, name: n, initials: ini };
        });
        populateUserDropdowns();
      });
    }

    function showImportLoading(title) {
      document.getElementById('import-loading-title').textContent = title;
      document.getElementById('import-loading-wrap').style.display = '';
    }
    function hideImportLoading() {
      document.getElementById('import-loading-wrap').style.display = 'none';
    }

    function importUsers() {
      var btn = document.getElementById('btn-import-users');
      if (!confirm('This will erase all existing users and reset all pair assignments. Attendance records for this session will also be cleared.\n\nProceed?')) { return; }
      btn.disabled = true; btn.textContent = 'Importing\u2026';
      showImportLoading('Importing users from Azure AD\u2026');
      // Edge Function now handles delete+insert with service role key — no client-side DB writes needed
      fetch(FN_BASE + '/import-users', { method: 'POST', headers: FN_HEADERS, body: JSON.stringify({ sessionId: state.curSessId }) })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          var imported = data.users || [];
          usersList = imported.map(function (u) {
            return { id: u.id, name: u.name, initials: u.initials || (u.name || '').slice(0, 2).toUpperCase() };
          });
          populateUserDropdowns();
          alert('Imported ' + imported.length + ' users.');
        })
        .catch(function (e) { alert('Import users failed: ' + e.message); })
        .finally(function () { hideImportLoading(); btn.disabled = false; btn.textContent = '\u2191 Import users'; });
    }

    function importFromSAP() {
      var btn = document.getElementById('btn-import-sap');
      if (!confirm('This will delete all existing items for this session and reload fresh from SAP. Count quantities, pair assignments, and drop status will be lost.\n\nProceed?')) { return; }
      btn.disabled = true; btn.textContent = 'Importing\u2026';
      showImportLoading('Fetching items from SAP\u2026');
      var sessEntity = cs() ? cs().entity : '';

      // Edge Function now handles delete+insert with service role key — no client-side DB writes needed
      fetch(FN_BASE + '/import-items', { method: 'POST', headers: FN_HEADERS, body: JSON.stringify({ sessionId: state.curSessId, entity: sessEntity }) })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          var imported = data.items || [];
          state.items = imported.map(mapItem);
          populateItemFilters(); renderItems(); buildDashboard();
          var entity = cs() ? cs().entity : '';
          var count = entity ? imported.filter(function (i) { return i.entity === entity; }).length : imported.length;
          alert('Imported ' + count + ' items' + (entity ? ' for ' + entity : '') + ' from SAP.');
        })
        .catch(function (e) { alert('Import failed: ' + (e.message || String(e))); })
        .finally(function () { hideImportLoading(); btn.disabled = false; btn.textContent = '\u2191 Import from SAP'; });
    }

    // ── Bin Combobox (multi-select) ──────────────────────────────────────────
    var _binOpts = [];        // [{id, name}]
    var _binSelections = [];  // [{id, qty}]

    function binComboSetOptions(bins) {
      _binOpts = bins || [];
    }
    function binSelReset() {
      _binSelections = [];
      var inp = document.getElementById('cvd-bin-input');
      if (inp) inp.value = '';
      renderBinSelections();
    }
    function binComboOpen() {
      binComboRender(document.getElementById('cvd-bin-input').value);
      var dd = document.getElementById('cvd-bin-dropdown');
      if (dd) dd.style.display = '';
      var ch = document.getElementById('cvd-bin-chevron');
      if (ch) ch.style.transform = 'rotate(180deg)';
    }
    function binComboClose() {
      var dd = document.getElementById('cvd-bin-dropdown');
      if (dd) dd.style.display = 'none';
      var ch = document.getElementById('cvd-bin-chevron');
      if (ch) ch.style.transform = '';
    }
    function binComboToggle() {
      var dd = document.getElementById('cvd-bin-dropdown');
      if (!dd) return;
      if (dd.style.display === 'none') binComboOpen(); else binComboClose();
    }
    function binComboFilter() {
      binComboRender(document.getElementById('cvd-bin-input').value);
      var dd = document.getElementById('cvd-bin-dropdown');
      if (dd) dd.style.display = '';
    }
    function binComboRender(query) {
      var dd = document.getElementById('cvd-bin-dropdown');
      if (!dd) return;
      var q = (query || '').trim().toLowerCase();
      var filtered = q
        ? _binOpts.filter(function(b){
            return b.id.toLowerCase().includes(q) || (b.name && b.name.toLowerCase().includes(q));
          })
        : _binOpts;
      if (!filtered.length) {
        dd.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--text-3);">'
          + (q ? 'No bins matched \u201c' + q + '\u201d' : 'No bins loaded.') + '</div>';
        return;
      }
      dd.innerHTML = filtered.map(function(b) {
        var label = b.name && b.name !== b.id ? b.id + ' \u2014 ' + b.name : b.id;
        var sel = !!_binSelections.find(function(s){ return s.id === b.id; });
        return '<div class="bin-opt" onmousedown="event.preventDefault()" onclick="binComboSelect(\'' + b.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')"'
          + ' style="padding:8px 14px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;'
          + (sel ? 'background:var(--accent-light);font-weight:600;' : '') + '">'
          + '<span>' + label + '</span>'
          + (sel ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 6 4.5 9.5 10.5 2.5"/></svg>' : '')
          + '</div>';
      }).join('');
    }
    function binComboSelect(id) {
      var existing = _binSelections.find(function(s){ return s.id === id; });
      if (existing) {
        // Deselect — keep dropdown open so user can re-pick
        _binSelections = _binSelections.filter(function(s){ return s.id !== id; });
        binComboRender(document.getElementById('cvd-bin-input').value);
        renderBinSelections();
      } else {
        // Select — close dropdown, focus qty input
        _binSelections.push({ id: id, qty: '' });
        binComboClose();
        renderBinSelections();
        setTimeout(function() {
          var el = document.getElementById('cvd-bin-single-qty');
          if (!el) {
            var rows = document.querySelectorAll('#cvd-bin-list .cv-qty-input');
            if (rows.length) el = rows[rows.length - 1];
          }
          if (el) el.focus();
        }, 30);
      }
    }
    function renderBinSelections() {
      var list = document.getElementById('cvd-bin-list');
      if (!list) return;
      var totalEl = document.getElementById('cvd-bin-total');
      if (!_binSelections.length) {
        list.innerHTML = '';
        if (totalEl) totalEl.style.display = 'none';
        return;
      }
      if (_binSelections.length === 1) {
        // Single bin: show a focused qty input, no row list
        var s = _binSelections[0];
        var match = _binOpts.find(function(b){ return b.id === s.id; });
        var label = match ? (match.name && match.name !== match.id ? match.id + ' \u2014 ' + match.name : match.id) : s.id;
        list.innerHTML = '<div style="margin-top:4px;">'
          + '<div style="font-size:11px;font-weight:600;color:var(--primary);margin-bottom:4px;">Qty for <span style="font-family:monospace;">' + label + '</span></div>'
          + '<input id="cvd-bin-single-qty" class="cv-qty-input" type="number" min="0" placeholder="0"'
          + ' value="' + (s.qty !== '' ? s.qty : '') + '" oninput="binSelQtyChange(0,this.value)" />'
          + '</div>';
        if (totalEl) totalEl.style.display = 'none';
        return;
      }
      // Multiple bins: show row list with per-bin qty inputs
      list.innerHTML = _binSelections.map(function(s, idx) {
        var match = _binOpts.find(function(b){ return b.id === s.id; });
        var label = match ? (match.name && match.name !== match.id ? match.id + ' \u2014 ' + match.name : match.id) : s.id;
        return '<div class="cvd-bin-row">'
          + '<span class="cvd-bin-label">' + label + '</span>'
          + '<input class="cv-qty-input" type="number" min="0" placeholder="0" value="' + (s.qty !== '' ? s.qty : '') + '"'
          + ' oninput="binSelQtyChange(' + idx + ',this.value)"'
          + ' style="width:80px;height:36px;font-size:15px;padding:0 8px;" />'
          + '<button type="button" class="cvd-bin-remove" onclick="binSelRemove(' + idx + ')" title="Remove">\u2715</button>'
          + '</div>';
      }).join('');
      _updateBinTotal();
    }
    function _updateBinTotal() {
      var total = _binSelections.reduce(function(sum, s){ return sum + (s.qty !== '' ? +s.qty : 0); }, 0);
      var totalEl = document.getElementById('cvd-bin-total');
      if (!totalEl) return;
      if (_binSelections.length > 1) {
        totalEl.style.display = '';
        document.getElementById('cvd-bin-total-val').textContent = total;
      } else {
        totalEl.style.display = 'none';
      }
    }
    function binSelQtyChange(idx, val) {
      if (_binSelections[idx]) _binSelections[idx].qty = val;
      _updateBinTotal();
    }
    function binSelRemove(idx) {
      _binSelections.splice(idx, 1);
      renderBinSelections();
      binComboRender(document.getElementById('cvd-bin-input').value);
    }

    // ── Scan & Count ──────────────────────────────────────────────────────────
    var COUNT_SESS_KEY = 'stp_count_sess';
    var countItemId = null;
    
    
    
    var scanStream = null;
    var scanRafId = null;
    var scanLastTime = 0;
    var countPhotoFiles = [];
    var countSaveForced = false;

    // ── Count History page ────────────────────────────────────────────────────
    var _histAuditRows = [];

    function goHistory() {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.getElementById('page-history').classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
      document.getElementById('nav-history').classList.add('active');
      mnavSetActive('mnav-history');
      document.getElementById('bc-sep').style.display = 'none';
      document.getElementById('bc-cur').style.display = 'none';
      document.getElementById('topbar-right').innerHTML = '';
      loadHistory();
    }

    function loadHistory() {
      var loginWarn = document.getElementById('hist-login-warn');
      var filterBar = document.getElementById('hist-filter-bar');
      var loading = document.getElementById('hist-loading');
      var empty = document.getElementById('hist-empty');
      var list = document.getElementById('hist-list');
      loginWarn.style.display = 'none';
      filterBar.style.display = 'none';
      loading.style.display = '';
      empty.style.display = 'none';
      list.innerHTML = '';
      if (!state.ssoUserName) {
        loading.style.display = 'none';
        loginWarn.style.display = '';
        return;
      }
      // Get all pair partners for this user
      sb.from('pairs').select('counter_name,checker_name').or('counter_name.eq.' + state.ssoUserName + ',checker_name.eq.' + state.ssoUserName).then(function(pRes) {
        var names = [state.ssoUserName];
        if (!pRes.error && pRes.data) {
          pRes.data.forEach(function(p) {
            var buddy = p.counter_name === state.ssoUserName ? p.checker_name : p.counter_name;
            if (buddy && names.indexOf(buddy) === -1) names.push(buddy);
          });
        }
        sb.from('item_audit').select('*').in('submitted_by', names).order('counted_at', { ascending: false }).limit(200).then(function(aRes) {
          loading.style.display = 'none';
          if (aRes.error || !aRes.data || !aRes.data.length) { empty.style.display = ''; return; }
          _histAuditRows = aRes.data;
          // Populate session filter
          var sessSelect = document.getElementById('hist-sess-filter');
          var sessIds = {};
          aRes.data.forEach(function(r) { if (r.session_id) sessIds[r.session_id] = true; });
          sessSelect.innerHTML = '<option value="">All sessions</option>';
          Object.keys(sessIds).forEach(function(sid) {
            var sess = state.S.find(function(s) { return s.id === sid; });
            var opt = document.createElement('option');
            opt.value = sid;
            opt.textContent = sess ? sess.name : sid;
            sessSelect.appendChild(opt);
          });
          filterBar.style.display = '';
          renderHistory();
        });
      });
    }

    function renderHistory() {
      var list = document.getElementById('hist-list');
      var empty = document.getElementById('hist-empty');
      var filterVal = document.getElementById('hist-sess-filter').value;
      var rows = filterVal ? _histAuditRows.filter(function(r) { return r.session_id === filterVal; }) : _histAuditRows;
      list.innerHTML = '';
      if (!rows.length) { empty.style.display = ''; return; }
      empty.style.display = 'none';
      rows.forEach(function(row) {
        var d = new Date(row.counted_at);
        var timeStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var isSelf = row.submitted_by === state.ssoUserName;
        var sess = state.S.find(function(s) { return s.id === row.session_id; });
        var isEdited = row.edited_qty !== null && row.edited_qty !== undefined;
        var el = document.createElement('div');
        el.className = 'cvd-hist-row';
        var qtyHtml = isEdited
          ? '<span style="text-decoration:line-through;opacity:0.45;font-size:13px;">' + (row.count_qty !== null ? row.count_qty : '—') + '</span>' +
            '<span style="font-size:18px;font-weight:700;color:var(--primary);display:block;line-height:1.1;">' + row.edited_qty + '</span>'
          : '+' + (row.count_qty !== null && row.count_qty !== undefined ? row.count_qty : '—');
        var editedBadge = isEdited
          ? ' <span style="background:#dbeafe;color:#1d4ed8;border-radius:4px;font-size:10px;font-weight:700;padding:1px 6px;vertical-align:middle;">Edited</span>'
          : '';
        var itemData = state.countItems.find(function(x){ return x.id === row.item_id; })
          || state.items.find(function(x){ return x.id === row.item_id; });
        var batch = row.batch || (itemData && itemData.batch && itemData.batch !== '\u2014' ? itemData.batch : null);
        el.innerHTML =
          '<div class="cvd-hist-qty">' + qtyHtml + '</div>' +
          '<div class="cvd-hist-meta">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-1);font-family:monospace;line-height:1.3;">' + (row.item_code || '—') + '</div>' +
          '<div style="font-size:12px;color:var(--text-1);line-height:1.3;">' + (row.item_name || '—') + '</div>' +
          (batch ? '<div style="font-size:11px;color:var(--text-2);line-height:1.3;">Batch: ' + batch + '</div>' : '') +
          (editedBadge ? '<div style="margin-top:2px;">' + editedBadge + '</div>' : '') +
          '<div style="margin-top:3px;">' +
          (row.warehouse ? '<span style="font-size:11px;color:var(--primary);font-weight:600;">' + row.warehouse + '</span>' + ' · ' : '') +
          '<span class="cvd-hist-who" style="color:' + (isSelf ? 'var(--primary)' : 'var(--text-2)') + ';">' + (row.submitted_by || '—') + '</span>' +
          (isEdited ? ' · <span style="font-size:11px;color:var(--text-3);">approved by ' + row.edited_by + '</span>' : '') +
          (sess ? ' · <span style="font-size:11px;color:var(--text-3);">' + sess.name + '</span>' : '') +
          '</div>' +
          '<div><span class="cvd-hist-time">' + timeStr + '</span></div>' +
          '</div>' +
          (isSelf && !isEdited ? '<div style="margin-left:auto;padding-left:8px;flex-shrink:0;">' +
            '<button class="btn btn-sm" onclick="openHistEdit(this,\'' + row.id + '\',\'' + row.item_id + '\',\'' + (row.item_code||'') + '\',\'' + (row.item_name||'').replace(/'/g,'\\\'') + '\',' + (row.count_qty||0) + ',\'' + row.session_id + '\')">Edit Qty</button>' +
            '</div>' : '');
        list.appendChild(el);
      });
    }

    var _histEditState = null;
    function openHistEdit(btn, auditId, itemId, itemCode, itemName, oldQty, sessId) {
      // Close any existing edit form
      var existing = document.getElementById('hist-edit-form');
      if (existing) existing.remove();
      if (_histEditState && _histEditState.btn === btn) { _histEditState = null; return; }
      _histEditState = { btn: btn, auditId: auditId, itemId: itemId, itemCode: itemCode, itemName: itemName, oldQty: oldQty, sessId: sessId };
      var form = document.createElement('div');
      form.id = 'hist-edit-form';
      form.style.cssText = 'background:#f8fafc;border:0.5px solid var(--border);border-radius:8px;padding:12px;margin-top:8px;';
      form.innerHTML = '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Edit Qty — ' + itemCode + ' <span style="font-weight:400;color:var(--text-2);">' + itemName + '</span></div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input class="input" id="hist-edit-qty" type="number" step="any" value="' + oldQty + '" style="width:100px;" placeholder="New qty" />' +
        '<button class="btn btn-primary btn-sm" onclick="submitHistEdit()">Submit for Approval</button>' +
        '<button class="btn btn-sm" onclick="document.getElementById(\'hist-edit-form\').remove();_histEditState=null;">Cancel</button>' +
        '</div>' +
        '<div style="font-size:10px;color:var(--text-3);margin-top:6px;">Your edit will be sent to admin for approval before taking effect.</div>';
      btn.closest('.cvd-hist-row').after(form);
      setTimeout(function(){ document.getElementById('hist-edit-qty').focus(); }, 50);
    }

    function submitHistEdit() {
      if (!_histEditState) return;
      var newQty = parseFloat(document.getElementById('hist-edit-qty').value);
      if (isNaN(newQty)) { alert('Please enter a valid quantity.'); return; }
      var s = _histEditState;
      var adjId = 'ADJ-' + Date.now().toString(36).toUpperCase();
      var row = {
        id: adjId, session_id: s.sessId,
        item_id: s.itemId, item_code: s.itemCode, item_name: s.itemName,
        old_qty: s.oldQty, new_qty: newQty,
        submitted_by: state.ssoUserName || null,
        audit_id: s.auditId,
        status: 'Pending'
      };
      var btn = document.getElementById('hist-edit-form').querySelector('button');
      btn.disabled = true; btn.textContent = 'Submitting…';
      sb.from('count_adjustments').insert(row).then(function(res) {
        if (res.error) { alert('Failed to submit: ' + res.error.message); btn.disabled = false; btn.textContent = 'Submit for Approval'; return; }
        document.getElementById('hist-edit-form').remove();
        _histEditState = null;
        // Show inline confirmation
        var toast = document.createElement('div');
        toast.className = 'banner bn-success';
        toast.textContent = 'Edit submitted for admin approval.';
        toast.style.cssText = 'margin-top:8px;';
        document.getElementById('hist-list').prepend(toast);
        setTimeout(function(){ toast.remove(); }, 3000);
      });
    }

    function goCount() {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.getElementById('page-count').classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
      document.getElementById('nav-count').classList.add('active');
      mnavSetActive('mnav-count');
      document.getElementById('bc-sep').style.display = 'none';
      document.getElementById('bc-cur').style.display = 'none';
      document.getElementById('topbar-right').innerHTML = '';
      // Always fetch fresh sessions before showing anything
      sb.from('sessions').select('*').order('created_at', { ascending: false }).then(function (res) {
        if (!res.error && res.data) {
          state.S = res.data.map(function (s) {
            return {
              id: s.id, name: s.name, type: s.type, entity: s.entity, country: s.country,
              start: s.start_date, end: s.end_date, status: s.status,
              progress: s.progress || 0, rc: !!s.is_recount, parentId: s.parent_id || null,
              userVisible: s.user_visible !== false
            };
          });
        }
        var saved = localStorage.getItem(COUNT_SESS_KEY);
        if (saved) {
          var sess = state.S.find(function (s) { return s.id === saved; });
          if (sess && sess.status === 'Active' && sess.userVisible) {
            // Resume saved session
            selectCountSession(saved, false);
            return;
          }
          // Session ended or hidden
          localStorage.removeItem(COUNT_SESS_KEY);
          document.getElementById('cv-home-ended').textContent =
            sess ? 'Your previous session "' + sess.name + '" is no longer available. Please select another.' :
              'Your previous session is no longer available. Please select another.';
          document.getElementById('cv-home-ended').style.display = '';
        }
        showCountHome();
      });
    }

    function showCountHome() {
      stopScanner();
      document.getElementById('cv-home-view').style.display = '';
      document.getElementById('cv-search-view').style.display = 'none';
      document.getElementById('cv-detail-view').style.display = 'none';
      var grid = document.getElementById('cv-home-grid');
      var emptyEl = document.getElementById('cv-home-empty');
      grid.innerHTML = '';
      var visible = state.S.filter(function (s) { return s.status === 'Active' && s.userVisible; });
      if (!visible.length) { emptyEl.style.display = ''; return; }
      emptyEl.style.display = 'none';
      visible.forEach(function (s) {
        var card = document.createElement('div');
        card.className = 'ush-card';
        card.setAttribute('role', 'button');
        card.innerHTML =
          '<div class="ush-card-name">' + s.name + '</div>' +
          '<div class="ush-card-meta">' +
          s.entity + ' &nbsp;·&nbsp; ' + s.type + '<br>' +
          fmtRange(s.start, s.end) +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">' +
          '<span style="font-size:10px;font-weight:500;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;">Tap to count</span>' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</div>';
        card.onclick = function () { selectCountSession(s.id, true); };
        grid.appendChild(card);
      });
    }

    function selectCountSession(sid, loadFresh) {
      if (!checkLogin()) return;
      var sess = state.S.find(function (s) { return s.id === sid; });
      if (!sess) return;
      state.countSessId = sid;
      localStorage.setItem(COUNT_SESS_KEY, sid);
      document.getElementById('cv-active-name').textContent = sess.name + ' (' + sess.entity + ')' + (state.ssoUserName ? '  ·  ' + state.ssoUserName : '');
      document.getElementById('cv-home-view').style.display = 'none';
      document.getElementById('cv-detail-view').style.display = 'none';
      document.getElementById('cv-search-view').style.display = 'block';
      history.pushState({ stp: 'count-search' }, '');
      var ms = document.getElementById('btn-multiscan');
      if (ms) ms.style.display = (state.ssoUserRole === 'Admin' || state.ssoUserRole === 'Multiscan') ? '' : 'none';
      var hideNew = !!(sess && sess.rc);
      var newBtn = document.getElementById('btn-new-item');
      var newFab = document.getElementById('btn-new-item-fab');
      if (newBtn) newBtn.style.display = hideNew ? 'none' : '';
      if (newFab) newFab.style.display = hideNew ? 'none' : '';
      document.getElementById('cv-gallery-view').style.display = 'none';
      document.getElementById('cv-empty').style.display = 'none';
      document.getElementById('cv-q').value = '';
      if (loadFresh || !state.countItems.length || state.countItems[0].sessionId !== sid) {
        state.countItems = [];
        loadCountItems();
      }
    }

    function changeCountSession() {
      state.countSessId = null;
      state.countItems = [];
      state.countPairId = null;
      localStorage.removeItem(COUNT_SESS_KEY);
      document.getElementById('cv-home-ended').style.display = 'none';
      showCountHome();
    }

    function loadCountItems() {
      if (!state.countSessId) return;
      var banner = document.getElementById('cv-sess-banner');
      banner.className = 'banner bn-info'; banner.textContent = 'Loading items…'; banner.style.display = '';
      var allRows = [];
      var sess = state.S.find(function (x) { return x.id === state.countSessId; });
      var isRC = !!(sess && sess.rc);
      function fetchPage(from) {
        sb.from('items')
          .select('id, code, name, count_qty, sap_qty, item_status, bin_location, damaged_qty, expired_qty, remark, batch, uom, new_item, pair_id, assigned_to, dropped, photos, group, entity, wh_code')
          .eq('session_id', state.countSessId)
          .eq('dropped', false)
          .order('code', { ascending: true })
          .range(from, from + 999)
          .then(function (res) {
          if (res.error) { banner.className = 'banner bn-danger'; banner.textContent = 'Failed to load: ' + res.error.message; return; }
          allRows = allRows.concat(res.data || []);
          if (res.data && res.data.length === 1000) { fetchPage(from + 1000); }
          else {
            state.countItems = allRows.map(mapItem);
            _buildWhFilter();
            if (isRC) {
              filterRecountByPair(sess);
            } else {
              banner.style.display = 'none';
              if (state.ssoUserName) {
                sb.from('pairs').select('id,counter_name,checker_name').eq('session_id', state.countSessId).then(function(pRes) {
                  if (!pRes.error && pRes.data) {
                    var p = pRes.data.find(function(p) { return p.counter_name === state.ssoUserName || p.checker_name === state.ssoUserName; });
                    state.countPairId = p ? p.id : null;
                  }
                });
              }
            }
          }
        });
      }
      fetchPage(0);
    }
    function filterRecountByPair(sess) {
      var banner = document.getElementById('cv-sess-banner');
      sb.from('pairs').select('*').eq('session_id', state.countSessId).then(function (res) {
        var userPair = null;
        if (!res.error && res.data && state.ssoUserName) {
          userPair = res.data.find(function (p) {
            return p.counter_name === state.ssoUserName || p.checker_name === state.ssoUserName;
          });
        }
        if (userPair) {
          state.countPairId = userPair.id;
          state.countItems = state.countItems.filter(function (i) { return i.pairId === userPair.id; });
          banner.style.display = 'none';
        } else {
          // No pair match — show all items with a warning
          banner.className = 'banner bn-warn';
          banner.textContent = (sess ? sess.name : state.countSessId) + ' (Recount) — ' + state.countItems.length + ' state.items. You are not assigned to a pair — showing all state.items.';
        }
        showRecountList();
      });
    }
    function _buildWhFilter() {
      var sel = document.getElementById('cv-wh-sel');
      if (!sel) return;
      var whSet = {};
      state.countItems.forEach(function(i) { if (i.wh) whSet[i.wh] = true; });
      var codes = Object.keys(whSet).sort();
      sel.innerHTML = '<option value="">All WH</option>';
      codes.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
      });
      state._countWhFilter = '';
      sel.value = '';
      var whGroup = document.getElementById('cv-wh-group');
      var show = codes.length > 1;
      sel.style.display = show ? '' : 'none';
      if (whGroup) whGroup.style.display = show ? '' : 'none';
    }
    function clearCountWhFilter() {
      var sel = document.getElementById('cv-wh-sel');
      if (sel) { sel.value = ''; state._countWhFilter = ''; }
      countSearch();
    }
    function countWhFilter() {
      state._countWhFilter = document.getElementById('cv-wh-sel').value;
      var gallery = document.getElementById('cv-gallery-view');
      if (gallery && gallery.style.display !== 'none') {
        var q = (document.getElementById('cv-q') || {}).value || '';
        if (q.trim()) { countSearch(); } else { showRecountList(); }
      }
    }
    function showRecountList() {
      var grid = document.getElementById('cv-result-grid');
      grid.innerHTML = '';
      var visItems = state._countWhFilter
        ? state.countItems.filter(function(i) { return i.wh === state._countWhFilter; })
        : state.countItems;
      document.getElementById('cv-gallery-label').textContent =
        visItems.length + ' item' + (visItems.length !== 1 ? 's' : '') + ' to recount — tap to count';
      visItems.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'cv-item-card';
        var hasBatch = item.batch && item.batch !== '—';
        var hasCnt = item.cnt !== null && item.cnt !== undefined;
        card.innerHTML =
          '<div class="cv-item-primary">' +
          '<span class="cv-item-code-tag">' + item.code + '</span>' +
          (hasBatch ? '<span class="cv-item-batch-tag">Batch: ' + item.batch + '</span>' : '') +
          '</div>' +
          '<div class="cv-item-name">' + item.name + '</div>' +
          '<div class="cv-item-meta">SAP Qty: <strong>' + (item.sap !== null && item.sap !== undefined ? item.sap : '—') + '</strong> ' + item.uom + (item.wh ? ' · ' + item.wh : '') + '</div>' +
          (hasCnt ? '<div class="cv-item-counted">✓ Recounted</div>' : '<div class="cv-item-uncounted">Not yet recounted</div>');
        card.onclick = function () { openCountDetail(item.id); };
        grid.appendChild(card);
      });
      document.getElementById('cv-empty').style.display = visItems.length ? 'none' : '';
      document.getElementById('cv-gallery-view').style.display = '';
    }

    function showCountSearch() {
      stopScanner();
      document.getElementById('cv-home-view').style.display = 'none';
      document.getElementById('cv-search-view').style.display = 'block';
      document.getElementById('cv-detail-view').style.display = 'none';
      countItemId = null;
      countPhotoFiles = [];
      countSaveForced = false;
    }

    function countSearch() {
      if (!state.countSessId) { showCountHome(); return; }
      var q = document.getElementById('cv-q').value.trim().toLowerCase();
      var sessEntity = (state.S.find(function(s){ return s.id === state.countSessId; }) || {}).entity || '';
      var entityFilter = function(i) { return !sessEntity || !i.entity || i.entity === sessEntity; };
      var whFilter = function(i) { return !state._countWhFilter || i.wh === state._countWhFilter; };

      // 1. Exact code match (barcode scan lands here)
      var exact = state.countItems.filter(function(i) {
        return entityFilter(i) && whFilter(i) && i.code.toLowerCase() === q;
      });
      if (exact.length) {
        if (exact.length === 1) { openCountDetail(exact[0].id); return; }
        var results = exact;
      } else {
        // 2. Starts-with on code, then contains on name / batch
        var results = !q ? [] : state.countItems.filter(function (i) {
          if (!entityFilter(i)) return false;
          if (!whFilter(i)) return false;
          return i.code.toLowerCase().startsWith(q) ||
                 i.name.toLowerCase().includes(q) ||
                 (i.batch && i.batch !== '—' && i.batch.toLowerCase() === q);
        });
      }
      var gallery = document.getElementById('cv-gallery-view');
      var empty = document.getElementById('cv-empty');
      var hint = document.getElementById('cv-wh-hint');
      if (!q) { gallery.style.display = 'none'; empty.style.display = 'none'; if (hint) hint.style.display = 'none'; return; }
      if (results.length === 0) {
        gallery.style.display = 'none'; empty.style.display = '';
        if (hint) {
          if (state._countWhFilter) {
            // Check if the same query hits items in other warehouses
            var crossWh = state.countItems.filter(function(i) {
              if (!entityFilter(i)) return false;
              return i.code.toLowerCase().startsWith(q) ||
                     i.name.toLowerCase().includes(q) ||
                     (i.batch && i.batch !== '—' && i.batch.toLowerCase() === q);
            });
            if (crossWh.length) {
              hint.innerHTML = 'No match in <strong>' + state._countWhFilter + '</strong>. Found <strong>' + crossWh.length + '</strong> item' + (crossWh.length !== 1 ? 's' : '') + ' in other warehouses. <button class="btn btn-sm" style="font-size:11px;padding:2px 8px;margin-left:4px;" onclick="clearCountWhFilter()">Search all warehouse codes</button>';
              hint.style.display = '';
            } else { hint.style.display = 'none'; }
          } else { hint.style.display = 'none'; }
        }
        return;
      }
      empty.style.display = 'none'; if (hint) hint.style.display = 'none';
      if (results.length === 1) { openCountDetail(results[0].id); return; }
      document.getElementById('cv-gallery-label').textContent = results.length + ' items found — select one to count';
      var grid = document.getElementById('cv-result-grid');
      grid.innerHTML = '';
      results.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'cv-item-card';
        var hasBatch = item.batch && item.batch !== '—';
        var hasWh = item.wh && item.wh !== '—';
        card.innerHTML =
          (hasBatch ? '<div style="font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:2px;">Batch: ' + item.batch + '</div>' : '') +
          (hasWh ? '<div style="font-size:15px;font-weight:600;color:var(--primary);margin-bottom:4px;">' + item.wh + '</div>' : '') +
          '<div style="font-size:12px;color:var(--text-2);margin-bottom:3px;">' + item.code + ' · ' + item.name + '</div>' +
          '<div style="font-size:11px;color:var(--text-3);">' + item.uom + '</div>' +
          (item.cnt !== null && item.cnt !== undefined ? '<div class="cv-item-counted">✓ Counted</div>' : '<div class="cv-item-uncounted">Not yet counted</div>');
        card.onclick = function () { openCountDetail(item.id); };
        grid.appendChild(card);
      });
      gallery.style.display = '';
    }

    function openCountDetail(itemId) {
      var item = state.countItems.find(function (x) { return x.id === itemId; });
      if (!item) return;
      countItemId = itemId;
      countPhotoFiles = [];
      stopScanner();
      document.getElementById('cv-search-view').style.display = 'none';
      document.getElementById('cv-detail-view').style.display = 'block';
      history.pushState({ stp: 'count-detail' }, '');

      // Reset save state
      countSaveForced = false;
      var saveBtn = document.getElementById('cvd-save-btn');
      saveBtn.textContent = '\u2713 Save count'; saveBtn.disabled = false;
      document.getElementById('cvd-msg').style.display = 'none';

      // Eyeball verification header
      var sess = state.S.find(function (x) { return x.id === state.countSessId; });
      var isRC = !!(sess && sess.rc);
      document.getElementById('cvd-header').innerHTML =
        '<div class="cv-detail-code">' + item.code + '</div>' +
        '<div class="cv-detail-name">' + item.name + '</div>' +
        (item.batch && item.batch !== '—' ? '<div class="cv-detail-batch">Batch: ' + item.batch + '</div>' : '') +
        '<div class="cv-detail-chips">' +
        '<div class="cv-chip"><div class="cv-chip-lbl">Group</div><div class="cv-chip-val">' + (item.grp || '—') + '</div></div>' +
        '<div class="cv-chip"><div class="cv-chip-lbl">Warehouse</div><div class="cv-chip-val">' + (item.wh || item.warehouse || '—') + '</div></div>' +
        '<div class="cv-chip"><div class="cv-chip-lbl">UoM</div><div class="cv-chip-val">' + item.uom + '</div></div>' +
        (isRC ? '<div class="cv-chip"><div class="cv-chip-lbl">SAP Qty</div><div class="cv-chip-val">' + item.sap + '</div></div>' : '') +
        (item.pkg ? '<div class="cv-chip"><div class="cv-chip-lbl">Pkg Size</div><div class="cv-chip-val">' + item.pkg + '</div></div>' : '') +
        '<div class="cv-chip"><div class="cv-chip-lbl">Expiry</div><div class="cv-chip-val">' + (item.expiry || '—') + '</div></div>' +
        '</div>';

      // Pre-fill existing values — bin location always starts blank (user must select)
      binSelReset();
      document.getElementById('cvd-dmg').value = item.dmg !== null && item.dmg !== undefined ? item.dmg : '';
      document.getElementById('cvd-exp').value = item.expQty !== null && item.expQty !== undefined ? item.expQty : '';
      document.getElementById('cvd-remark').value = item.remark || '';
      document.getElementById('cvd-preview').innerHTML = '';
      document.getElementById('cvd-photo-count').textContent = (item.photos && item.photos.length) ? item.photos.length + ' existing photo(s)' : 'No photos selected';
      document.getElementById('cvd-msg').style.display = 'none';
    }

    function compressImage(file, maxKB, callback) {
      var maxBytes = maxKB * 1024;
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        URL.revokeObjectURL(url);
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        var maxDim = 1600;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var quality = 0.85;
        function tryCompress() {
          canvas.toBlob(function(blob) {
            if (blob.size <= maxBytes || quality <= 0.1) {
              callback(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else { quality = Math.round((quality - 0.1) * 10) / 10; tryCompress(); }
          }, 'image/jpeg', quality);
        }
        tryCompress();
      };
      img.onerror = function() { URL.revokeObjectURL(url); callback(file); };
      img.src = url;
    }

    function previewPhotos() {
      var inp = document.getElementById('cvd-photos');
      countPhotoFiles = Array.from(inp.files);
      var preview = document.getElementById('cvd-preview');
      preview.innerHTML = '';
      document.getElementById('cvd-photo-count').textContent = countPhotoFiles.length + ' photo(s) selected';
      countPhotoFiles.forEach(function (f) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = document.createElement('img');
          img.className = 'photo-thumb';
          img.src = e.target.result;
          preview.appendChild(img);
        };
        reader.readAsDataURL(f);
      });
    }

    function saveCountData() {
      if (!countItemId) return;
      var item = state.countItems.find(function (x) { return x.id === countItemId; });
      if (!item) return;
      var btn = document.getElementById('cvd-save-btn');

      var newBinIds = _binSelections.map(function(s){ return s.id; }).filter(Boolean);
      var binVal = newBinIds.length ? newBinIds.join('; ') : null;
      var hasEmptyQty = _binSelections.some(function(s){ return s.qty === '' || s.qty === null || s.qty === undefined; });
      var cntVal = _binSelections.length ? _binSelections.reduce(function(sum, s){ return sum + (s.qty !== '' ? +s.qty : 0); }, 0) : null;

      // Validate required fields
      var msg = document.getElementById('cvd-msg');
      if (!binVal) {
        msg.className = 'banner bn-danger'; msg.textContent = 'Select at least one bin location.'; msg.style.display = '';
        return;
      }
      if (hasEmptyQty) {
        msg.className = 'banner bn-danger'; msg.textContent = 'Enter a count qty for each bin location.'; msg.style.display = '';
        return;
      }
      msg.style.display = 'none';

      // Accumulate count qty
      var prevCnt = (item.cnt !== null && item.cnt !== undefined) ? +item.cnt : 0;
      var accCnt = cntVal !== null ? prevCnt + cntVal : (item.cnt !== null && item.cnt !== undefined ? +item.cnt : null);

      // Accumulate bin locations (semicolon-joined, no duplicates)
      var prevBins = (item.warehouse && item.warehouse !== '—') ? item.warehouse.split(';').map(function(b){ return b.trim(); }).filter(Boolean) : [];
      newBinIds.forEach(function(bid){ if (prevBins.indexOf(bid) === -1) prevBins.push(bid); });
      var accBin = prevBins.length ? prevBins.join('; ') : null;

      // Blind-count mismatch check (non-recount sessions only, first attempt only)
      var sess = state.S.find(function (x) { return x.id === state.countSessId; });
      var isRC = !!(sess && sess.rc);
      if (!isRC && !countSaveForced && accCnt !== null && accCnt !== item.sap) {
        var msg = document.getElementById('cvd-msg');
        msg.className = 'banner bn-warn';
        msg.textContent = 'Counted quantity does not match SAP quantity. Please verify and try again.';
        msg.style.display = '';
        btn.textContent = '\u26a0 Confirm save';
        countSaveForced = true;
        return;
      }

      btn.disabled = true; btn.textContent = 'Saving\u2026';

      var dmgVal = document.getElementById('cvd-dmg').value !== '' ? +document.getElementById('cvd-dmg').value : null;
      var expVal = document.getElementById('cvd-exp').value !== '' ? +document.getElementById('cvd-exp').value : null;
      var remarkVal = document.getElementById('cvd-remark').value.trim() || null;

      function doSave(photoUrls) {
        var existingPhotos = item.photos || [];
        var allPhotos = existingPhotos.concat(photoUrls);
        var update = {
          bin_location: accBin,
          count_qty: accCnt,
          damaged_qty: dmgVal,
          expired_qty: expVal,
          remark: remarkVal,
          photos: JSON.stringify(allPhotos),
          pair_id: state.countPairId || item.pairId || null,
          submitted_by: state.ssoUserName || null
        };
        sb.from('items').update(update).eq('id', countItemId).then(function (res) {
          btn.disabled = false; btn.textContent = '✓ Save count';
          if (res.error) {
            var msg = document.getElementById('cvd-msg');
            msg.className = 'banner bn-danger'; msg.textContent = 'Save failed: ' + res.error.message; msg.style.display = '';
            return;
          }
          // Update local cache
          item.warehouse = accBin || '—'; item.cnt = accCnt; item.dmg = dmgVal; item.expQty = expVal;
          item.remark = remarkVal || ''; item.photos = allPhotos;
          if (state.countPairId) item.pairId = state.countPairId;
          countSaveForced = false;
          // Always reflect Matched / Variance status when count is saved
          if (accCnt !== null) {
            var newStatus = (accCnt === item.sap) ? 'Matched' : 'Variance';
            item.itemStatus = newStatus;
            sb.from('items').update({ item_status: newStatus }).eq('id', countItemId).then(function(){});
            // Sync admin item master cache if loaded
            var masterItem = state.items.find(function(x){ return x.id === countItemId; });
            if (masterItem) {
              masterItem.itemStatus = newStatus;
              masterItem.cnt = accCnt;
              masterItem.dmg = dmgVal;
              masterItem.expQty = expVal;
              masterItem.remark = remarkVal || '';
              masterItem.warehouse = accBin || '—';
            }
          }
          // Insert audit record
          var auditRow = {
            id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            session_id: state.countSessId,
            item_id: countItemId,
            item_code: item.code,
            item_name: item.name,
            submitted_by: state.ssoUserName || null,
            pair_id: item.pairId || null,
            count_qty: cntVal,
            damaged_qty: dmgVal,
            expired_qty: expVal,
            warehouse: binVal || null,
            remark: remarkVal || null
          };
          sb.from('item_audit').insert(auditRow).then(function () { });
          var msg = document.getElementById('cvd-msg');
          msg.className = 'banner bn-success'; msg.textContent = 'Saved \u2714'; msg.style.display = '';
          setTimeout(function () {
            document.getElementById('cv-q').value = '';
            document.getElementById('cv-gallery-view').style.display = 'none';
            document.getElementById('cv-empty').style.display = 'none';
            showCountSearch();
          }, 600);
        });
      }

      if (countPhotoFiles.length === 0) { doSave([]); return; }

      // Upload photos to Supabase Storage (compressed to <100KB)
      var uploaded = [];
      var uploadErrors = [];
      var pending = countPhotoFiles.length;
      countPhotoFiles.forEach(function (f) {
        compressImage(f, 100, function(compressed) {
          var path = 'items/' + countItemId + '/' + Date.now() + '_' + compressed.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          sb.storage.from('item-photos').upload(path, compressed, { upsert: true }).then(function (res) {
            if (res.error) {
              console.error('Photo upload failed:', res.error);
              uploadErrors.push(res.error.message || 'Unknown error');
            } else {
              var urlRes = sb.storage.from('item-photos').getPublicUrl(path);
              if (urlRes.data) uploaded.push(urlRes.data.publicUrl);
            }
            pending--;
            if (pending === 0) {
              if (uploadErrors.length) {
                alert('Photo upload failed: ' + uploadErrors[0] + '\n\nCount was saved without photo. Check that the "item-photos" storage bucket exists and has public upload policy in Supabase.');
              }
              doSave(uploaded);
            }
          });
        });
      });
    }

    // ── Attendance QR Generation (admin) ─────────────────────────────────────
    var _attQrCountdownTimer = null;

    function attQrToken(sessId) {
      return 'att:' + sessId + ':' + Math.floor(Date.now() / 60000);
    }

    function startAttQr() {
      if (!state.curSessId) return;
      var section = document.getElementById('att-qr-section');
      if (!section) return;
      var isAdmin = (state.ssoUserRole === 'Admin');
      section.style.display = isAdmin ? '' : 'none';
      var addSection = document.getElementById('att-add-section');
      if (addSection) addSection.style.display = isAdmin ? '' : 'none';
      if (isAdmin) populateAttAddDropdown();
      if (!isAdmin) return;
      renderAttQr();
      _attQrCountdownTimer && clearInterval(_attQrCountdownTimer);
      _attQrCountdownTimer = setInterval(function () {
        var secsLeft = Math.ceil((60000 - (Date.now() % 60000)) / 1000);
        var el = document.getElementById('att-qr-countdown');
        if (el) el.textContent = secsLeft + 's';
        if (secsLeft >= 59) renderAttQr();
      }, 1000);
    }

    function stopAttQr() {
      if (_attQrCountdownTimer) { clearInterval(_attQrCountdownTimer); _attQrCountdownTimer = null; }
    }

    function renderAttQr() {
      if (!state.curSessId) return;
      var container = document.getElementById('att-qr-canvas');
      if (!container) return;
      container.innerHTML = '';
      if (!window.QRCode) { container.innerHTML = '<div style="font-size:11px;padding:20px;color:#c00;">QRCode library not loaded.</div>'; return; }
      new QRCode(container, { text: attQrToken(state.curSessId), width: 200, height: 200, colorDark: '#2C3E50', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }

    // ── Attendance QR Scanning (user) ─────────────────────────────────────────
    // Attendance QRs are detected automatically inside startScanner() by the "att:" prefix.
    // Users select a session first, then tap Scan and point at the admin's QR code.

    function processAttQrScan(text) {
      var parts = text.split(':');
      if (parts.length !== 3 || parts[0] !== 'att') {
        showSessBanner('error', 'Invalid QR code. Please scan the attendance QR displayed by admin.');
        return;
      }
      var sessId = parts[1];
      var tokenMinute = parseInt(parts[2], 10);
      var nowMinute = Math.floor(Date.now() / 60000);
      if (Math.abs(nowMinute - tokenMinute) > 1) {
        showSessBanner('error', 'QR code has expired. Ask admin to show you the latest code.');
        return;
      }
      markAttendance(sessId);
    }

    function markAttendance(sessId) {
      if (!state.ssoUserName) { showSessBanner('error', 'Please sign in first.'); return; }
      var userId = state.ssoUserName.toLowerCase().replace(/\s+/g, '_');
      fetch(FN_BASE + '/save-attendance', { method: 'POST', headers: FN_HEADERS, body: JSON.stringify({ session_id: sessId, user_id: userId, user_name: state.ssoUserName, attended: true }) }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function(e) { showSessBanner('error', 'Failed to mark attendance: ' + (e.error || 'Unknown error')); });
        }
        showSessBanner('success', '\u2713 Attendance marked! Welcome, ' + state.ssoUserName + '.');
        if (state.curSessId === sessId) loadAttendees();
      });
    }

    function showSessBanner(type, msg) {
      var el = document.getElementById('cv-sess-banner');
      if (!el) return;
      el.className = 'banner ' + (type === 'success' ? 'bn-success' : 'bn-danger');
      el.textContent = msg;
      el.style.display = '';
      clearTimeout(showSessBanner._t);
      showSessBanner._t = setTimeout(function () { el.style.display = 'none'; }, 5000);
    }

    function startScanner() {
      stopScanner();
      var wrap = document.getElementById('scanner-wrap');
      wrap.style.display = 'block';
      document.getElementById('btn-scan').disabled = true;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera not supported in this browser.');
        stopScanner(); return;
      }

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      }).then(function (stream) {
        scanStream = stream;
        var video = document.getElementById('scan-video');
        video.srcObject = stream;
        video.play().catch(function (e) { console.error('video.play():', e); });
        scanRafId = requestAnimationFrame(processScanFrame);
      }).catch(function (err) {
        stopScanner();
        alert('Cannot access camera. Please allow camera permission in browser settings.\n' + (err.message || err));
      });
    }

    function processScanFrame(ts) {
      if (!scanStream) return;
      // Throttle to ~10 fps
      if (ts - scanLastTime < 100) { scanRafId = requestAnimationFrame(processScanFrame); return; }
      scanLastTime = ts;

      var video = document.getElementById('scan-video');
      if (!video || video.readyState < 2) { scanRafId = requestAnimationFrame(processScanFrame); return; }

      // Try native BarcodeDetector first (Chrome/Android/Safari 17+)
      if (window.BarcodeDetector) {
        window.BarcodeDetector.getSupportedFormats().then(function (fmts) {
          return new BarcodeDetector({ formats: fmts }).detect(video);
        }).then(function (results) {
          if (results.length) { stopScanner(); handleScanResult(results[0].rawValue); }
          else { scanRafId = requestAnimationFrame(processScanFrame); }
        }).catch(function () { scanRafId = requestAnimationFrame(processScanFrame); });
        return;
      }

      // Fallback: jsQR for QR codes
      var canvas = document.getElementById('scan-canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = window.jsQR && window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code) { stopScanner(); handleScanResult(code.data); }
      else { scanRafId = requestAnimationFrame(processScanFrame); }
    }

    function handleScanResult(text) {
      if (text.startsWith('att:')) { processAttQrScan(text); }
      else { document.getElementById('cv-q').value = text; countSearch(); }
    }

    function stopScanner() {
      if (scanRafId) { cancelAnimationFrame(scanRafId); scanRafId = null; }
      if (scanStream) { scanStream.getTracks().forEach(function (t) { t.stop(); }); scanStream = null; }
      var video = document.getElementById('scan-video');
      if (video) video.srcObject = null;
      var wrap = document.getElementById('scanner-wrap');
      if (wrap) wrap.style.display = 'none';
      var btn = document.getElementById('btn-scan');
      if (btn) btn.disabled = false;
    }

    // ── New Item Form ────────────────────────────────────────────────────────
    var niPhotoFiles = [];

    function openNewItemForm(prefillCode) {
      stopScanner();
      ['cv-home-view','cv-search-view','cv-detail-view','cv-multiscan-view'].forEach(function(id){
        document.getElementById(id).style.display = 'none';
      });
      document.getElementById('cv-newitem-view').style.display = '';
      history.pushState({ stp: 'count-newitem' }, '');
      // Reset form
      document.getElementById('ni-code').value = prefillCode || '';
      ['ni-name','ni-uom','ni-serial','ni-bin','ni-remark'].forEach(function(id){ document.getElementById(id).value = ''; });
      ['ni-cnt','ni-dmg','ni-exp'].forEach(function(id){ document.getElementById(id).value = ''; });
      document.getElementById('ni-photos').value = '';
      document.getElementById('ni-preview').innerHTML = '';
      document.getElementById('ni-photo-count').textContent = 'No photos selected';
      document.getElementById('ni-msg').style.display = 'none';
      document.getElementById('ni-save-btn').disabled = false;
      document.getElementById('ni-save-btn').textContent = '\u2713 Submit new item';
      niPhotoFiles = [];
      // Populate bin datalist
      var dl = document.getElementById('ni-bins-dl');
      dl.innerHTML = _binOpts.map(function(b){
        var label = b.name && b.name !== b.id ? b.id + ' \u2014 ' + b.name : b.id;
        return '<option value="' + b.id + '">' + label + '</option>';
      }).join('');
      setTimeout(function(){ document.getElementById('ni-code').focus(); }, 80);
    }
    function closeNewItemForm() {
      document.getElementById('cv-newitem-view').style.display = 'none';
      document.getElementById('cv-search-view').style.display = 'block';
    }
    function niPreviewPhotos() {
      niPhotoFiles = Array.from(document.getElementById('ni-photos').files);
      var preview = document.getElementById('ni-preview');
      preview.innerHTML = '';
      document.getElementById('ni-photo-count').textContent = niPhotoFiles.length + ' photo(s) selected';
      niPhotoFiles.forEach(function(f) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = document.createElement('img'); img.className = 'photo-thumb'; img.src = e.target.result; preview.appendChild(img);
        };
        reader.readAsDataURL(f);
      });
    }
    function submitNewItem() {
      var code  = document.getElementById('ni-code').value.trim();
      var name  = document.getElementById('ni-name').value.trim();
      var uom   = document.getElementById('ni-uom').value.trim();
      var msg   = document.getElementById('ni-msg');
      var showErr = function(t){ msg.className='banner bn-danger'; msg.textContent=t; msg.style.display=''; };
      var serial = document.getElementById('ni-serial').value.trim();
      var binVal = document.getElementById('ni-bin').value.trim();
      if (!code)   return showErr('Item Code is required.');
      if (!name)   return showErr('Item Name is required.');
      if (!uom)    return showErr('UOM is required.');
      if (!serial) return showErr('Batch / Serial Number is required.');
      if (!binVal) return showErr('Bin Location is required.');
      var cntRaw = document.getElementById('ni-cnt').value;
      if (cntRaw === '') return showErr('Counted Qty is required.');
      if (!niPhotoFiles.length) return showErr('At least one photo is required.');
      var btn = document.getElementById('ni-save-btn');
      btn.disabled = true; btn.textContent = 'Submitting\u2026';
      msg.style.display = 'none';
      var newId = 'NI-' + Date.now().toString(36).toUpperCase();
      var cntVal = +cntRaw;
      var dmgVal = document.getElementById('ni-dmg').value !== '' ? +document.getElementById('ni-dmg').value : null;
      var expVal = document.getElementById('ni-exp').value !== '' ? +document.getElementById('ni-exp').value : null;
      var remark = document.getElementById('ni-remark').value.trim() || null;
      // Upload photos first (compressed to <100KB)
      var uploaded = []; var niUploadErrors = []; var pending = niPhotoFiles.length;
      niPhotoFiles.forEach(function(f) {
        compressImage(f, 100, function(compressed) {
          var path = 'items/' + newId + '/' + Date.now() + '_' + compressed.name.replace(/[^a-zA-Z0-9._-]/g,'_');
          sb.storage.from('item-photos').upload(path, compressed, { upsert: true }).then(function(res) {
            if (res.error) { console.error('Photo upload failed:', res.error); niUploadErrors.push(res.error.message || 'Unknown error'); }
            else { var u = sb.storage.from('item-photos').getPublicUrl(path); if (u.data) uploaded.push(u.data.publicUrl); }
            pending--;
            if (pending === 0) {
              if (niUploadErrors.length) alert('Photo upload failed: ' + niUploadErrors[0] + '\n\nItem was saved without photo. Check the "item-photos" storage bucket in Supabase.');
              doInsertNewItem(uploaded);
            }
          });
        });
      });
      function doInsertNewItem(photoUrls) {
        var row = {
          id: newId, session_id: state.countSessId,
          code: code, name: name, uom: uom, group: 'Unknown',
          batch: serial, bin_location: binVal, wh_code: 'New Item',
          sap_qty: 0, count_qty: cntVal, damaged_qty: dmgVal, expired_qty: expVal,
          remark: remark, photos: JSON.stringify(photoUrls),
          new_item: 'Yes', dropped: false,
          submitted_by: state.ssoUserName || null,
          pair_id: state.countPairId || null,
          entity: (state.S.find(function(s){ return s.id === state.countSessId; }) || {}).entity || null
        };
        sb.from('items').insert(row).then(function(res) {
          btn.disabled = false; btn.textContent = '\u2713 Submit new item';
          if (res.error) { showErr('Failed to save: ' + res.error.message); return; }
          // Audit trail
          sb.from('item_audit').insert({
            id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            session_id: state.countSessId,
            item_id: newId,
            item_code: code,
            item_name: name,
            submitted_by: state.ssoUserName || null,
            pair_id: state.countPairId || null,
            count_qty: cntVal,
            damaged_qty: dmgVal,
            expired_qty: expVal,
            remark: 'New item'
          }).then(function() {});
          msg.className = 'banner bn-success'; msg.textContent = 'New item submitted for admin review.'; msg.style.display = '';
          state.countItems.push(row);
          setTimeout(function(){
            document.getElementById('cv-q').value = '';
            document.getElementById('cv-gallery-view').style.display = 'none';
            document.getElementById('cv-empty').style.display = 'none';
            closeNewItemForm();
          }, 1000);
        });
      }
    }

    // ── Multiple Scan ────────────────────────────────────────────────────────
    function openMultiScan() {
      stopScanner();
      ['cv-home-view','cv-search-view','cv-detail-view','cv-newitem-view'].forEach(function(id){
        document.getElementById(id).style.display = 'none';
      });
      document.getElementById('cv-multiscan-view').style.display = '';
      history.pushState({ stp: 'count-multiscan' }, '');
      document.getElementById('ms-input').value = '';
      document.getElementById('ms-msg').style.display = 'none';
      document.getElementById('ms-log').innerHTML = '';
      var msb = document.getElementById('ms-count-badge'); if (msb) { msb.style.display = 'none'; msb._count = 0; var mn = document.getElementById('ms-count-num'); if (mn) mn.textContent = '0'; }
      _msLastCode = ''; _msLastTime = 0;
      setTimeout(function(){ document.getElementById('ms-input').focus(); }, 80);
    }
    function closeMultiScan() {
      document.getElementById('cv-multiscan-view').style.display = 'none';
      document.getElementById('cv-q').value = '';
      document.getElementById('cv-gallery-view').style.display = 'none';
      document.getElementById('cv-empty').style.display = 'none';
      document.getElementById('cv-search-view').style.display = 'block';
    }
    function _msErrorFeedback() {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.value = 330;
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
      } catch(e) {}
      var card = document.getElementById('ms-input') ? document.getElementById('ms-input').parentElement : null;
      if (!card) return;
      card.style.transition = 'background 0.05s';
      card.style.background = '#fca5a5';
      setTimeout(function() { card.style.transition = 'background 0.5s'; card.style.background = ''; }, 50);
    }
    var _msLastCode = '', _msLastTime = 0;
    function processMultiScan() {
      var inp = document.getElementById('ms-input');
      var code = inp.value.trim();
      inp.value = '';
      if (!code) return;
      // Debounce: same barcode within 500ms = duplicate scanner fire, ignore
      var now = Date.now();
      if (code === _msLastCode && now - _msLastTime < 500) return;
      _msLastCode = code;
      _msLastTime = now;
      var sessEntity = (state.S.find(function(s){ return s.id === state.countSessId; }) || {}).entity || '';
      // Match by batch OR item code, entity- and warehouse-filtered
      var match = state.countItems.find(function(i) {
        var matchEntity = !sessEntity || !i.entity || i.entity === sessEntity;
        var matchWh = !state._countWhFilter || i.wh === state._countWhFilter;
        return matchEntity && matchWh && (i.batch === code || i.code === code);
      });
      var log = document.getElementById('ms-log');
      var entry = document.createElement('div');
      entry.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;background:#fff;border-radius:8px;border:.5px solid var(--border);font-size:12px;';
      if (!match) {
        // XSS-safe: code comes from barcode scanner — use textContent/addEventListener
        var iconNotFound = document.createElement('span');
        iconNotFound.style.cssText = 'width:22px;height:22px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#e53e3e;';
        iconNotFound.textContent = '\u2717';
        var labelNotFound = document.createElement('span');
        labelNotFound.style.cssText = 'flex:1;color:#e53e3e;';
        var boldCode = document.createElement('strong');
        boldCode.textContent = code; // safe — no HTML parsing
        labelNotFound.appendChild(boldCode);
        labelNotFound.appendChild(document.createTextNode(' \u2014 not found in item master'));
        var addBtn = document.createElement('button');
        addBtn.className = 'btn btn-sm btn-primary';
        addBtn.style.cssText = 'font-size:10px;padding:3px 8px;';
        addBtn.textContent = '+ Add';
        var _codeRef = code;
        addBtn.addEventListener('click', function () { openNewItemForm(_codeRef); });
        entry.appendChild(iconNotFound);
        entry.appendChild(labelNotFound);
        entry.appendChild(addBtn);
        log.prepend(entry);
        return;
      }
      // Already counted — warn and skip
      if (match.cnt !== null && match.cnt !== undefined && match.cnt !== '') {
        _msErrorFeedback();
        var batchWarn = (match.batch && match.batch !== '—') ? match.batch : match.code;
        var msg = document.getElementById('ms-msg');
        if (msg) { msg.textContent = '\u26a0\ufe0f ' + batchWarn + ' is already counted (Qty: ' + match.cnt + ') — not saved.'; msg.style.display = ''; msg.style.color = '#d97706'; setTimeout(function(){ msg.style.display = 'none'; }, 4000); }
        return;
      }
      // Increment count
      var newCnt = ((match.cnt !== null && match.cnt !== undefined) ? +match.cnt : 0) + 1;
      match.cnt = newCnt;
      sb.from('items').update({ count_qty: newCnt }).eq('id', match.id).then(function(){});
      // Audit trail
      var msAuditRow = {
        id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        session_id: state.countSessId,
        item_id: match.id,
        item_code: match.code,
        item_name: match.name,
        submitted_by: state.ssoUserName || null,
        pair_id: state.countPairId || null,
        count_qty: newCnt,
        remark: 'Multi-scan'
      };
      sb.from('item_audit').insert(msAuditRow).then(function(){});
      var batchDisplay = (match.batch && match.batch !== '—') ? match.batch : match.code;
      // XSS-safe DOM construction for "found" entry
      var iconOk = document.createElement('span');
      iconOk.style.cssText = 'width:22px;height:22px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#10b981;';
      iconOk.textContent = '\u2713';
      var infoWrap = document.createElement('span');
      infoWrap.style.cssText = 'flex:1;min-width:0;';
      var batchDiv = document.createElement('div');
      batchDiv.style.cssText = 'font-family:monospace;font-size:13px;font-weight:700;color:var(--text);';
      batchDiv.textContent = batchDisplay;
      var detailDiv = document.createElement('div');
      detailDiv.style.cssText = 'font-size:11px;color:var(--text-3);margin-top:1px;';
      detailDiv.textContent = match.code + ' \u00b7 ' + match.name;
      infoWrap.appendChild(batchDiv);
      infoWrap.appendChild(detailDiv);
      var qtySpan = document.createElement('span');
      qtySpan.style.cssText = 'font-weight:700;color:var(--primary);flex-shrink:0;';
      qtySpan.textContent = 'Qty: ' + newCnt;
      entry.appendChild(iconOk);
      entry.appendChild(infoWrap);
      entry.appendChild(qtySpan);
      log.prepend(entry);
      var msb = document.getElementById('ms-count-badge');
      if (msb) { msb._count = (msb._count || 0) + 1; var mn = document.getElementById('ms-count-num'); if (mn) mn.textContent = msb._count; msb.style.display = 'flex'; }
      setTimeout(function(){ inp.focus(); }, 50);
    }

    function openPhotoGallery(itemId) {
      var item = state.items.find(function (x) { return x.id === itemId; }) || state.countItems.find(function (x) { return x.id === itemId; });
      if (!item || !item.photos || !item.photos.length) return;
      openPhotoLightbox(item.photos, 0);
    }

    function closePhotoModal() { var el = document.getElementById('photo-lightbox'); if (el) el.remove(); }

    // ── Warehouse Layout Images ────────────────────────────────────────────────
    // Edit this array to add your warehouse floor plan images.
    // Each entry: { label: 'Display name', src: 'URL or relative path to image' }
    // Leave src as '' to show a placeholder tile until you add the image.
    var LAYOUT_IMAGES = [
      { label: 'Ground Floor', src: '' },
      { label: 'Level 1', src: '' },
      { label: 'Cold Storage', src: '' },
      { label: 'Receiving Bay', src: '' },
    ];

    function openLayoutModal() {
      var grid = document.getElementById('layout-img-grid');
      var empty = document.getElementById('layout-no-images');
      grid.innerHTML = '';
      var hasAny = LAYOUT_IMAGES.length > 0;
      empty.style.display = hasAny ? 'none' : '';
      grid.style.display = hasAny ? '' : 'none';
      LAYOUT_IMAGES.forEach(function(img) {
        var card = document.createElement('div');
        card.className = 'layout-img-card';
        if (img.src) {
          card.innerHTML =
            '<img src="' + img.src + '" class="layout-img-thumb" alt="' + img.label + '" loading="lazy" />' +
            '<div class="layout-img-label">' + img.label + '</div>';
          card.onclick = function() { openLayoutLightbox(img.src, img.label); };
        } else {
          card.innerHTML =
            '<div class="layout-img-placeholder">' +
              '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20M9 9v12"/></svg>' +
              '<div style="font-size:11px;margin-top:6px;text-align:center;">No image<br>Add src in LAYOUT_IMAGES</div>' +
            '</div>' +
            '<div class="layout-img-label">' + img.label + '</div>';
        }
        grid.appendChild(card);
      });
      document.getElementById('layout-modal-wrap').style.display = '';
    }

    function closeLayoutModal() {
      document.getElementById('layout-modal-wrap').style.display = 'none';
    }

    function openLayoutLightbox(src, label) {
      var lb = document.getElementById('layout-lightbox');
      document.getElementById('layout-lightbox-img').src = src;
      document.getElementById('layout-lightbox-label').textContent = label;
      lb.style.display = 'flex';
    }

    function closeLayoutLightbox() {
      document.getElementById('layout-lightbox').style.display = 'none';
    }

    // ── Role-based admin guard ─────────────────────────────────────────────────
    function requireAdmin(fn) {
      if (!SSO_ENABLED) { fn(); return; }
      // Re-verify the role from the secure JWT on every protected action
      sb.auth.getUser().then(function(res) {
        var u = res.data && res.data.user;
        var liveRole = (u && u.app_metadata && u.app_metadata.role) || 'User';
        if (liveRole === 'Admin') {
          state.ssoUserRole = 'Admin'; // sync client-side cache
          fn();
        } else {
          alert('Access denied. Admin role required.');
        }
      });
    }
    // ── SSO / Login ───────────────────────────────────────────────────────────
    var SSO_ENABLED = true;
    var SSO_USER_KEY = 'stp_sso_user';
    var SSO_EMAIL_KEY = 'stp_sso_email';
    
    
    









    // ── Audit Trail ──────────────────────────────────────────────────────────
    function loadAudit() {
      if (!state.curSessId) return;
      var banner = document.getElementById('audit-banner');
      banner.textContent = 'Loading audit records…'; banner.style.display = '';
      var tbl = document.getElementById('audit-table');
      tbl.style.display = 'none';
      sb.from('item_audit').select('*').eq('session_id', state.curSessId).order('counted_at', { ascending: false }).then(function (res) {
        if (res.error) {
          var isTableMissing = res.error.message && (res.error.message.includes('schema cache') || res.error.message.includes('does not exist') || res.error.code === '42P01' || res.error.code === 'PGRST200');
          banner.className = 'banner bn-' + (isTableMissing ? 'warn' : 'danger');
          banner.textContent = isTableMissing
            ? 'Audit table not set up yet. Run data/schema.sql in Supabase SQL Editor to enable audit trail.'
            : 'Failed to load audit: ' + res.error.message;
          return;
        }
        var rows = res.data || [];
        if (!rows.length) { banner.className = 'banner bn-info'; banner.textContent = 'No audit records yet. Records are created when staff submit count data.'; return; }
        banner.style.display = 'none';
        var tb = document.getElementById('audit-tbody');
        tb.innerHTML = '';
        rows.forEach(function (r) {
          var dt = r.counted_at ? new Date(r.counted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
          var tr = document.createElement('tr');
          tr.innerHTML = '<td style="font-size:11px;white-space:nowrap;">' + dt + '</td>' +
            '<td style="font-family:monospace;font-size:11px;">' + (r.item_code || '—') + '</td>' +
            '<td>' + (r.item_name || '—') + '</td>' +
            '<td style="font-size:11px;">' + (r.submitted_by || '—') + '</td>' +
            '<td style="font-family:monospace;">' + (r.count_qty !== null && r.count_qty !== undefined ? r.count_qty : '—') + '</td>' +
            '<td style="font-family:monospace;">' + (r.damaged_qty !== null && r.damaged_qty !== undefined ? r.damaged_qty : '—') + '</td>' +
            '<td style="font-family:monospace;">' + (r.expired_qty !== null && r.expired_qty !== undefined ? r.expired_qty : '—') + '</td>' +
            '<td style="font-size:11px;">' + (r.warehouse || '—') + '</td>' +
            '<td style="font-size:11px;color:#666;">' + (r.remark || '') + '</td>';
          tb.appendChild(tr);
        });
        tbl.style.display = 'table';
      });
    }
    // ── Compact table toggle ─────────────────────────────────────────────────
    function toggleCompactTable() {
      var tbl = document.getElementById('items-table');
      var btn = document.getElementById('btn-compact-toggle');
      if (!tbl) return;
      var isCompact = tbl.classList.toggle('tbl-compact');
      if (btn) btn.textContent = isCompact ? 'Comfortable' : 'Compact';
    }

    // ── Pending Approvals ────────────────────────────────────────────────────
    function _setPendingBadge(n) {
      var badge = document.getElementById('pending-badge');
      if (!badge) return;
      if (n > 0) { badge.textContent = n > 99 ? '99+' : String(n); badge.style.display = ''; }
      else { badge.style.display = 'none'; }
    }
    function refreshPendingBadge() {
      if (!state.curSessId) { _setPendingBadge(0); return; }
      sb.from('count_adjustments').select('id', { count: 'exact', head: true })
        .eq('session_id', state.curSessId).eq('status', 'Pending')
        .then(function(res) { _setPendingBadge(res.error ? 0 : (res.count || 0)); });
    }
    function loadPendingApprovals() {
      if (!state.curSessId) return;
      var banner = document.getElementById('pending-banner');
      var tbl = document.getElementById('pending-table');
      banner.textContent = 'Loading…'; banner.className = 'banner bn-info'; banner.style.display = '';
      tbl.style.display = 'none';
      sb.from('count_adjustments').select('*').eq('session_id', state.curSessId).eq('status', 'Pending').order('created_at', { ascending: false }).then(function(res) {
        if (res.error) {
          var missing = res.error.message && (res.error.message.includes('does not exist') || res.error.code === '42P01' || res.error.code === 'PGRST200');
          banner.className = 'banner bn-' + (missing ? 'warn' : 'danger');
          banner.textContent = missing ? 'Pending Approval table not set up. Run the latest schema.sql in Supabase SQL Editor.' : 'Failed to load: ' + res.error.message;
          return;
        }
        var rows = res.data || [];
        _setPendingBadge(rows.length);
        if (!rows.length) { banner.className = 'banner bn-info'; banner.textContent = 'No pending approvals.'; return; }
        banner.style.display = 'none';
        var tb = document.getElementById('pending-tbody'); tb.innerHTML = '';
        rows.forEach(function(r) {
          var dt = r.created_at ? new Date(r.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
          var tr = document.createElement('tr');
          tr.innerHTML = '<td style="font-size:11px;white-space:nowrap;">' + dt + '</td>' +
            '<td style="font-family:monospace;font-size:11px;">' + (r.item_code || '—') + '</td>' +
            '<td>' + (r.item_name || '—') + '</td>' +
            '<td style="font-size:11px;">' + (r.submitted_by || '—') + '</td>' +
            '<td style="font-family:monospace;">' + (r.old_qty !== null && r.old_qty !== undefined ? r.old_qty : '—') + '</td>' +
            '<td style="font-family:monospace;font-weight:600;color:var(--primary);">' + (r.new_qty !== null && r.new_qty !== undefined ? r.new_qty : '—') + '</td>' +
            '<td><div style="display:flex;gap:5px;">' +
              '<button class="btn btn-sm btn-success" onclick="approveAdjustment(\'' + r.id + '\',\'' + r.item_id + '\',' + r.new_qty + ')">Approve</button>' +
              '<button class="btn btn-sm btn-danger" onclick="rejectAdjustment(\'' + r.id + '\')">Reject</button>' +
            '</div></td>';
          tb.appendChild(tr);
        });
        tbl.style.display = 'table';
      });
    }

    function approveAdjustment(adjId, itemId, newQty) {
      var now = new Date().toISOString();
      // Fetch the full adjustment row so we have old_qty, item_code, item_name, submitted_by
      sb.from('count_adjustments').select('*').eq('id', adjId).maybeSingle().then(function(adjRes) {
        var adj = (adjRes.data) || {};
        sb.from('count_adjustments').update({ status: 'Approved', reviewed_by: state.ssoUserName || 'Admin', reviewed_at: now }).eq('id', adjId).then(function(r1) {
          if (r1.error) { alert('Failed to approve: ' + r1.error.message); return; }
          sb.from('items').update({ count_qty: newQty }).eq('id', itemId).then(function(r2) {
            if (r2.error) { alert('Item update failed: ' + r2.error.message); return; }
            // Mark the original audit row as edited (preserves original count_qty for trail)
            if (adj.audit_id) {
              sb.from('item_audit')
                .update({ edited_qty: newQty, edited_by: state.ssoUserName || 'Admin' })
                .eq('id', adj.audit_id)
                .then(function() {});
            }
            // Update local cache
            var itm = state.items.find(function(x){ return x.id === itemId; });
            if (itm) itm.cnt = newQty;
            loadPendingApprovals();
          });
        });
      });
    }

    function rejectAdjustment(adjId) {
      var now = new Date().toISOString();
      sb.from('count_adjustments').update({ status: 'Rejected', reviewed_by: state.ssoUserName || 'Admin', reviewed_at: now }).eq('id', adjId).then(function(r) {
        if (r.error) { alert('Failed to reject: ' + r.error.message); return; }
        loadPendingApprovals();
      });
    }

    // ─────────────────────────────────────────────────────────────────────────

    // ── Export Item Master ────────────────────────────────────────────────────
    // Reads directly from the DOM table so it always mirrors whatever columns
    // are currently displayed — including any columns added in future.
    function exportItemMaster() {
      var table = document.getElementById('items-table');
      if (!table) { alert('Item master table not found. Open the Item Master tab first.'); return; }
      var ths = Array.from(table.querySelectorAll('thead th'));
      // Identify which column indices to skip:
      //   - checkbox col: <th> contains only an <input> (no text)
      //   - hidden cols: display:none
      //   - "Action" col: header text is "Action" (drop/recover buttons)
      var skipCols = new Set();
      var headers = [];
      ths.forEach(function (th, i) {
        if (th.style.display === 'none') { skipCols.add(i); return; }
        var text = th.textContent.trim();
        if (!text || text === 'Action') { skipCols.add(i); return; }
        headers.push(text);
      });
      var rows = [headers];
      Array.from(table.querySelectorAll('tbody tr')).forEach(function (tr) {
        var cells = Array.from(tr.querySelectorAll('td'));
        var row = [];
        cells.forEach(function (td, i) {
          if (skipCols.has(i)) return;
          // Pair assignment dropdown — export selected option text
          var sel = td.querySelector('select');
          if (sel) { var opt = sel.options[sel.selectedIndex]; row.push(opt ? opt.textContent.trim() : ''); return; }
          // Badge spans — export the badge text
          var badge = td.querySelector('.badge');
          if (badge) { row.push(badge.textContent.trim()); return; }
          // Photo button — export count number only
          var photoBtn = td.querySelector('.photo-link-btn');
          if (photoBtn) { var m = photoBtn.textContent.match(/\d+/); row.push(m ? m[0] + ' photo(s)' : ''); return; }
          // Default: plain text, collapse whitespace
          row.push(td.textContent.trim().replace(/\s+/g, ' '));
        });
        rows.push(row);
      });
      // Build CSV with UTF-8 BOM so Excel opens it correctly
      var csv = rows.map(function (row) {
        return row.map(function (val) {
          var s = String(val === null || val === undefined ? '' : val);
          if (/[,"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
          return s;
        }).join(',');
      }).join('\r\n');
      var sess = cs();
      var fname = (sess ? sess.name.replace(/[^a-z0-9]/gi, '_') : 'items') + '_ItemMaster.csv';
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Cal.com-style Date Picker ──────────────────────────────────────────────
    var _calState = {};

    function toggleCalPicker(id) {
      var popup = document.getElementById('calpop-' + id);
      var trigger = document.getElementById('caltrig-' + id);
      if (!popup || !trigger) return;
      var isOpen = popup.classList.contains('open');
      document.querySelectorAll('.cal-popup.open').forEach(function(p) { p.classList.remove('open'); });
      if (!isOpen) {
        var val = document.getElementById(id).value;
        var base = val ? new Date(val + 'T00:00:00') : new Date();
        _calState[id] = { year: base.getFullYear(), month: base.getMonth(), selected: val || null };
        _renderCalGrid(id);
        // Position popup using fixed coords so it escapes modal overflow clipping
        var rect = trigger.getBoundingClientRect();
        var popW = 288, popH = 320;
        var top = rect.bottom + 6;
        var left = rect.left;
        // Prevent overflow on right edge
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        // Flip above if below viewport
        if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
        popup.style.top = top + 'px';
        popup.style.left = left + 'px';
        popup.classList.add('open');
      }
    }

    function calNav(id, dir) {
      var s = _calState[id]; if (!s) return;
      s.month += dir;
      if (s.month < 0) { s.month = 11; s.year--; }
      if (s.month > 11) { s.month = 0; s.year++; }
      _renderCalGrid(id);
    }

    function _renderCalGrid(id) {
      var s = _calState[id]; if (!s) return;
      var grid = document.getElementById('calgrid-' + id);
      var lbl = document.getElementById('calmon-' + id);
      if (!grid || !lbl) return;
      var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      lbl.textContent = MONTHS[s.month] + ' ' + s.year;
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + _p2(today.getMonth()+1) + '-' + _p2(today.getDate());
      var firstDow = new Date(s.year, s.month, 1).getDay();
      var daysInMon = new Date(s.year, s.month + 1, 0).getDate();
      var daysInPrev = new Date(s.year, s.month, 0).getDate();
      var html = '';
      // prev month overflow
      for (var i = firstDow - 1; i >= 0; i--) {
        var d = daysInPrev - i;
        var py = s.month === 0 ? s.year - 1 : s.year;
        var pm = s.month === 0 ? 12 : s.month;
        var ds = py + '-' + _p2(pm) + '-' + _p2(d);
        html += '<button class="cal-day-btn cal-outside" onclick="selectCalDay(\'' + id + '\',\'' + ds + '\');event.stopPropagation()">' + d + '</button>';
      }
      // current month
      for (var d = 1; d <= daysInMon; d++) {
        var ds = s.year + '-' + _p2(s.month + 1) + '-' + _p2(d);
        var cls = 'cal-day-btn';
        if (ds === s.selected) cls += ' cal-selected';
        if (ds === todayStr) cls += ' cal-today';
        html += '<button class="' + cls + '" onclick="selectCalDay(\'' + id + '\',\'' + ds + '\');event.stopPropagation()">' + d + '</button>';
      }
      // next month overflow (fill to complete last row)
      var total = firstDow + daysInMon;
      var rem = total % 7 === 0 ? 0 : 7 - (total % 7);
      for (var d = 1; d <= rem; d++) {
        var ny = s.month === 11 ? s.year + 1 : s.year;
        var nm = s.month === 11 ? 1 : s.month + 2;
        var ds = ny + '-' + _p2(nm) + '-' + _p2(d);
        html += '<button class="cal-day-btn cal-outside" onclick="selectCalDay(\'' + id + '\',\'' + ds + '\');event.stopPropagation()">' + d + '</button>';
      }
      grid.innerHTML = html;
    }

    function selectCalDay(id, dateStr) {
      var s = _calState[id]; if (s) s.selected = dateStr;
      setCalPickerVal(id, dateStr);
      document.getElementById('calpop-' + id).classList.remove('open');
    }

    function setCalPickerVal(id, dateStr) {
      var inp = document.getElementById(id);
      if (inp) inp.value = dateStr || '';
      var disp = document.getElementById('caldisp-' + id);
      if (disp) {
        if (dateStr) {
          disp.textContent = _fmtCalDate(dateStr);
          disp.classList.remove('placeholder');
        } else {
          disp.textContent = 'Select date\u2026';
          disp.classList.add('placeholder');
        }
      }
    }

    function _fmtCalDate(ds) {
      if (!ds) return '';
      var p = ds.split('-');
      var MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return parseInt(p[2], 10) + ' ' + MONS[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }

    function _p2(n) { return n < 10 ? '0' + String(n) : String(n); }

    // Close cal popups when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.cal-pick-wrap')) {
        document.querySelectorAll('.cal-popup.open').forEach(function(p) { p.classList.remove('open'); });
      }
    });

    // ── Ruixen-style Column Toggle ─────────────────────────────────────────────
    function toggleColMenu(menuId) {
      var m = document.getElementById(menuId); if (!m) return;
      var isOpen = m.classList.contains('open');
      document.querySelectorAll('.col-toggle-menu.open').forEach(function(x) { x.classList.remove('open'); });
      if (!isOpen) m.classList.add('open');
    }
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.col-toggle-wrap')) {
        document.querySelectorAll('.col-toggle-menu.open').forEach(function(x) { x.classList.remove('open'); });
      }
    });

    function toggleItemCol(colName, visible) {
      var table = document.getElementById('items-table'); if (!table) return;
      var ths = Array.from(table.querySelectorAll('thead th'));
      var colIdx = -1;
      ths.forEach(function(th, i) { if (th.dataset.col === colName) colIdx = i; });
      if (colIdx === -1) return;
      ths[colIdx].style.display = visible ? '' : 'none';
      Array.from(table.querySelectorAll('tbody tr')).forEach(function(row) {
        if (row.cells[colIdx]) row.cells[colIdx].style.display = visible ? '' : 'none';
      });
    }

    // ── Column sort ──────────────────────────────────────────────────────────
    function sortItemsBy(col) { if(!state._sortKeyMap[col])return; state._itemPage=0; if(state._sortCol===col){state._sortDir*=-1;}else{state._sortCol=col;state._sortDir=1;} renderItems(); }
    function updateSortIndicators() { document.querySelectorAll('#items-table thead th[data-colkey]').forEach(function(th){ var ind=th.querySelector('.sort-ind'); if(!ind){ind=document.createElement('span');ind.className='sort-ind';ind.style.cssText='margin-left:3px;font-size:10px;opacity:0.6;';th.appendChild(ind);} ind.textContent=th.dataset.colkey===state._sortCol?(state._sortDir===1?'▲':'▼'):''; }); }

    // ── Column drag-and-drop reorder ────────────────────────────────────────
    var _colOrder = [];
    var _dragColIdx = null;

    function initColDrag() {
      var table = document.getElementById('items-table');
      if (!table || table._colDragInited) return;
      table._colDragInited = true;
      if (!_colOrder.length) {
        _colOrder = Array.from(table.querySelectorAll('thead th')).map(function(th) { return th.dataset.colkey || ''; });
      }
      var theadRow = table.querySelector('thead tr');
      Array.from(theadRow.cells).forEach(function(th) {
        var ck = th.dataset.colkey;
        if (!ck || ck === 'chk' || ck === 'action') return;
        th.draggable = true;
        th.addEventListener('click', function() { if(!state._isDragging) sortItemsBy(th.dataset.colkey); });
        th.addEventListener('dragstart', function(e) {
          state._isDragging = true;
          _dragColIdx = Array.from(theadRow.cells).indexOf(th);
          e.dataTransfer.effectAllowed = 'move';
          th.classList.add('col-dragging');
        });
        th.addEventListener('dragend', function() {
          setTimeout(function(){ state._isDragging=false; },0);
          th.classList.remove('col-dragging');
          Array.from(theadRow.cells).forEach(function(t) { t.classList.remove('col-drag-over'); });
          _dragColIdx = null;
        });
        th.addEventListener('dragover', function(e) {
          e.preventDefault();
          Array.from(theadRow.cells).forEach(function(t) { t.classList.remove('col-drag-over'); });
          th.classList.add('col-drag-over');
        });
        th.addEventListener('drop', function(e) {
          e.preventDefault();
          th.classList.remove('col-drag-over');
          if (_dragColIdx === null) return;
          var toIdx = Array.from(theadRow.cells).indexOf(th);
          if (_dragColIdx === toIdx) return;
          moveColInTable(_dragColIdx, toIdx);
          _colOrder = Array.from(theadRow.cells).map(function(t) { return t.dataset.colkey || ''; });
          _dragColIdx = null;
        });
      });
    }

    function moveColInTable(fromIdx, toIdx) {
      var table = document.getElementById('items-table');
      if (!table) return;
      Array.from(table.querySelectorAll('tr')).forEach(function(row) {
        var cells = Array.from(row.cells);
        if (fromIdx >= cells.length || toIdx >= cells.length) return;
        var cell = cells[fromIdx];
        if (fromIdx < toIdx) row.insertBefore(cell, cells[toIdx].nextSibling);
        else row.insertBefore(cell, cells[toIdx]);
      });
    }

    function applyColOrder() {
      initColDrag();
      if (!_colOrder.length) return;
      var table = document.getElementById('items-table');
      if (!table) return;
      var rc = isRC();
      var tbodyBase = rc
        ? ['chk','code','name','grp','batch','uom','pkg','expiry','category','sap','cnt','dmg','exp','by','whcode','binloc','photos','pair','src','status','action']
        : ['chk','code','name','grp','batch','uom','pkg','expiry','category','sap','cnt','dmg','exp','by','whcode','binloc','photos','status','action'];
      var baseSet = {};
      tbodyBase.forEach(function(k) { baseSet[k] = true; });
      var desiredOrder = _colOrder.filter(function(k) { return baseSet[k]; });
      // Append any base keys missing from _colOrder at the end
      tbodyBase.forEach(function(k) { if (desiredOrder.indexOf(k) === -1) desiredOrder.push(k); });
      Array.from(table.querySelectorAll('tbody tr')).forEach(function(row) {
        var cells = Array.from(row.cells);
        if (cells.length !== tbodyBase.length) return;
        var map = {};
        tbodyBase.forEach(function(key, i) { map[key] = cells[i]; });
        desiredOrder.forEach(function(key) { if (map[key]) row.appendChild(map[key]); });
      });
    }

    // ── Bulk assign pair ─────────────────────────────────────────────────────
    function renderBulkPairs() {
      var sel = document.getElementById('bulk-pair-sel');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Assign pair —</option>' + pairOpts();
    }

    function bulkAssign() {
      var pid = document.getElementById('bulk-pair-sel').value;
      if (!pid) return;
      var p = state.pairs.find(function(x) { return x.id === pid; });
      var label = p ? (p.c + ' / ' + p.k) : null;
      var ids = Array.from(state.selItems);
      if (!ids.length) return;
      // Update local items
      ids.forEach(function(id) {
        var i = state.items.find(function(x) { return x.id === id; });
        if (i) { i.pairId = pid; i.assignedTo = label; }
      });
      // Persist to Supabase in chunks of 200
      var chunkSize = 200;
      for (var c = 0; c < ids.length; c += chunkSize) {
        var chunk = ids.slice(c, c + chunkSize);
        sb.from('items').update({ pair_id: pid, assigned_to: label }).in('id', chunk).then(function(res) {
          if (res.error) console.error('Bulk assign failed:', res.error.message);
        });
      }
      state.selItems.clear();
      renderItems();
    }

    function applyItemColVisibility() {
      var menu = document.getElementById('items-col-menu'); if (!menu) return;
      menu.querySelectorAll('input[type=checkbox]').forEach(function(cb) {
        var colName = cb.getAttribute('onchange').match(/'([^']+)'/)[1];
        toggleItemCol(colName, cb.checked);
      });
    }

    function initFromAPI() { loadWarehouses(); loadUsers(); loadSessions(); }
    // ──────────────────────────────────────────────────────────────────────────

    // Restore cached UI instantly (avoids flash)
    applySsoUser();

    initFromAPI();

    function navigateByRole() {
      if (state.ssoUserRole === 'Admin') {
        goSessions();
      } else {
        goCount();
      }
    }

    // On load: check for existing Supabase Auth session (persists across tabs + browser restart)
    if (SSO_ENABLED) {
      sb.auth.getSession().then(function(result) {
        var session = result.data && result.data.session;
        if (!session || !session.user) {
          // No valid session — show login
          state.ssoUserName = ''; state.ssoUserEmail = ''; state.ssoUserRole = 'User';
          sessionStorage.removeItem(SSO_USER_KEY);
          sessionStorage.removeItem(SSO_EMAIL_KEY);
          try { sessionStorage.removeItem('stp_sso_role'); } catch(e) {}
          try { sessionStorage.removeItem('state.SSO_ROLE_KEY'); } catch(e) {}
          applySsoUser();
          showSsoOverlay();
          return;
        }
        // Valid session — fetch display name
        var email = session.user.email;
        sb.from('users').select('display_name, name, role').eq('email', email).maybeSingle().then(function(uRes) {
          var u = uRes.data || {};
          state.ssoUserName = u.display_name || u.name || email;
          state.ssoUserEmail = email;
          // Read authoritative role from the secure JWT
          state.ssoUserRole = (session.user.app_metadata && session.user.app_metadata.role) || 'User';
          
          sessionStorage.setItem(SSO_USER_KEY, state.ssoUserName);
          sessionStorage.setItem(SSO_EMAIL_KEY, state.ssoUserEmail);
          applySsoUser();
          navigateByRole();
        });
      });
    }

    // ── Admin Users & Roles ──────────────────────────────────────────────────
    function openAdminUsers() {
      requireAdmin(function() {
        document.getElementById('admin-email-input').value = '';
        document.getElementById('admin-role-msg').textContent = '';
        document.getElementById('admin-users-wrap').style.display = '';
      });
    }

    function makeUserAdmin() {
      var email = document.getElementById('admin-email-input').value.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        document.getElementById('admin-role-msg').innerHTML = '<span style="color:#e53e3e;">Enter a valid email address.</span>';
        return;
      }
      var btn = document.getElementById('btn-promote-admin');
      btn.disabled = true; btn.textContent = 'Promoting…';
      document.getElementById('admin-role-msg').innerHTML = '<span style="color:var(--text-3);">Processing...</span>';

      sb.rpc('set_user_role', { target_email: email, new_role: 'Admin' }).then(function(res) {
        btn.disabled = false; btn.textContent = 'Promote to Admin';
        if (res.error) {
          document.getElementById('admin-role-msg').innerHTML = '<span style="color:#e53e3e;">Failed: ' + res.error.message + '</span>';
        } else {
          document.getElementById('admin-role-msg').innerHTML = '<span style="color:#10b981;">Success! ' + email + ' is now an Admin.</span>';
          document.getElementById('admin-email-input').value = '';
        }
      });
    }

// --- Global Window Exports for Inline HTML Handlers ---
window.cs = cs;
window.isRC = isRC;
window.varItems = varItems;
window.approvedNew = approvedNew;
window.linkedRC = linkedRC;
window.mnavSetActive = mnavSetActive;






window.showTab = showTab;
window.loadPairs = loadPairs;
window.loadAttendees = loadAttendees;
window.crossCheckPairsAttendance = crossCheckPairsAttendance;
window.toggleAttendee = toggleAttendee;
window.renderAttendance = renderAttendance;
window.populateAttAddDropdown = populateAttAddDropdown;
window.addAttendeeManual = addAttendeeManual;
window.validatePairForm = validatePairForm;
window.validatePairFormRC = validatePairFormRC;
window.renderPairBanner = renderPairBanner;
window.toggleAddPair = toggleAddPair;
window.refreshPairFormDropdowns = refreshPairFormDropdowns;
window.createPair = createPair;
window.renderPairs = renderPairs;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.renderDrawer = renderDrawer;
window.openRepair = openRepair;
window.confirmRepair = confirmRepair;
window.closeRepair = closeRepair;
window.openEditWarehouse = openEditWarehouse;
window.saveEditWarehouse = saveEditWarehouse;
window.closeEditWarehouse = closeEditWarehouse;
window.openEditPair = openEditPair;
window.validateEditPair = validateEditPair;
window.saveEditPair = saveEditPair;
window.deletePair = deletePair;
window.closeEditPair = closeEditPair;
window.pairOpts = pairOpts;
window.populateItemFilters = populateItemFilters;
window.renderItems = renderItems;
window.changeItemPair = changeItemPair;
window.showItemToast = showItemToast;
window.toggleItem = toggleItem;
window.filterItems = filterItems;
window.itemPageNav = itemPageNav;
window.rowCheckClick = rowCheckClick;
window.updateSel = updateSel;
window.toggleAllItems = toggleAllItems;
window.selectAllFiltered = selectAllFiltered;
window.clearSel = clearSel;
window.bulkDrop = bulkDrop;
window.bulkRecover = bulkRecover;
window.buildDashboard = buildDashboard;
window.openDrilldown = openDrilldown;
window.drilldownTab = drilldownTab;
window.closeDrilldown = closeDrilldown;
window.showRemarkPopup = showRemarkPopup;
window.renderGallery = renderGallery;
window.setGalleryStatus = setGalleryStatus;












window.loadItems = loadItems;
window.applyBinOptions = applyBinOptions;
window.loadWarehouses = loadWarehouses;
window.syncBinsFromWebhook = syncBinsFromWebhook;
window.populateUserDropdowns = populateUserDropdowns;
window.loadUsers = loadUsers;
window.showImportLoading = showImportLoading;
window.hideImportLoading = hideImportLoading;
window.importUsers = importUsers;
window.importFromSAP = importFromSAP;
window.binComboSetOptions = binComboSetOptions;
window.binComboOpen = binComboOpen;
window.binComboClose = binComboClose;
window.binComboToggle = binComboToggle;
window.binComboFilter = binComboFilter;
window.binComboRender = binComboRender;
window.binComboSelect = binComboSelect;
window.binSelReset = binSelReset;
window.renderBinSelections = renderBinSelections;
window.binSelQtyChange = binSelQtyChange;
window.binSelRemove = binSelRemove;
window.goHistory = goHistory;
window.loadHistory = loadHistory;
window.renderHistory = renderHistory;
window.openHistEdit = openHistEdit;
window.submitHistEdit = submitHistEdit;
window.goCount = goCount;
window.showCountHome = showCountHome;
window.selectCountSession = selectCountSession;
window.changeCountSession = changeCountSession;
window.loadCountItems = loadCountItems;
window.filterRecountByPair = filterRecountByPair;
window.showRecountList = showRecountList;
window.countWhFilter = countWhFilter;
window.clearCountWhFilter = clearCountWhFilter;
window.refreshPendingBadge = refreshPendingBadge;
window.showCountSearch = showCountSearch;
window.countSearch = countSearch;
window.openCountDetail = openCountDetail;
window.compressImage = compressImage;
window.previewPhotos = previewPhotos;
window.saveCountData = saveCountData;
window.attQrToken = attQrToken;
window.startAttQr = startAttQr;
window.stopAttQr = stopAttQr;
window.renderAttQr = renderAttQr;
window.processAttQrScan = processAttQrScan;
window.markAttendance = markAttendance;
window.showSessBanner = showSessBanner;
window.startScanner = startScanner;
window.processScanFrame = processScanFrame;
window.handleScanResult = handleScanResult;
window.stopScanner = stopScanner;
window.openNewItemForm = openNewItemForm;
window.closeNewItemForm = closeNewItemForm;
window.niPreviewPhotos = niPreviewPhotos;
window.submitNewItem = submitNewItem;
window.openMultiScan = openMultiScan;
window.closeMultiScan = closeMultiScan;
window.processMultiScan = processMultiScan;
window.openPhotoGallery = openPhotoGallery;
window.closePhotoModal = closePhotoModal;
window.photoLightboxNav = photoLightboxNav;
window.openLayoutModal = openLayoutModal;
window.closeLayoutModal = closeLayoutModal;
window.openLayoutLightbox = openLayoutLightbox;
window.closeLayoutLightbox = closeLayoutLightbox;
window.requireAdmin = requireAdmin;








window.loadAudit = loadAudit;
window.toggleCompactTable = toggleCompactTable;
window.loadPendingApprovals = loadPendingApprovals;
window.approveAdjustment = approveAdjustment;
window.rejectAdjustment = rejectAdjustment;
window.exportItemMaster = exportItemMaster;
window.toggleCalPicker = toggleCalPicker;
window.calNav = calNav;
window._renderCalGrid = _renderCalGrid;
window.selectCalDay = selectCalDay;
window.setCalPickerVal = setCalPickerVal;
window._fmtCalDate = _fmtCalDate;
window._p2 = _p2;
window.toggleColMenu = toggleColMenu;
window.toggleItemCol = toggleItemCol;
window.sortItemsBy = sortItemsBy;
window.updateSortIndicators = updateSortIndicators;
window.initColDrag = initColDrag;
window.moveColInTable = moveColInTable;
window.applyColOrder = applyColOrder;
window.renderBulkPairs = renderBulkPairs;
window.bulkAssign = bulkAssign;
window.applyItemColVisibility = applyItemColVisibility;
window.initFromAPI = initFromAPI;
window.navigateByRole = navigateByRole;
window.openAdminUsers = openAdminUsers;
window.makeUserAdmin = makeUserAdmin;
window.sbQuery = sbQuery;

// ── Scan & Count — browser back-button support ───────────────────────────
window.addEventListener('popstate', function (e) {
  var countPage = document.getElementById('page-count');
  if (!countPage || !countPage.classList.contains('active')) return;
  var stp = (e.state && e.state.stp) || '';
  if (stp === 'count-search') {
    showCountSearch();
  } else if (stp === 'count-detail' || stp === 'count-newitem' || stp === 'count-multiscan') {
    // Forward entry — shouldn't normally reach here via back; just go to search
    showCountSearch();
    history.pushState({ stp: 'count-search' }, '');
  } else {
    // Back past the session-select push → return to home screen
    showCountHome();
  }
});

