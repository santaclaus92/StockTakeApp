import { state } from './store.js';
import { sb } from './supabase.js';

export function getSsoInitials(name) {
      return (name || '?').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    }

export function applySsoUser() {
      document.getElementById('sb-name').textContent = state.ssoUserName || 'Not signed in';
      document.getElementById('sb-avatar').textContent = getSsoInitials(state.ssoUserName);
    }

export function checkLogin() {
      if (false) return true; // SSO always enabled
      if (!state.ssoUserName) { showSsoOverlay(); return false; }
      return true;
    }

export function showSsoOverlay() {
      document.getElementById('sso-step-email').style.display = '';
      document.getElementById('sso-step-code').style.display = 'none';
      document.getElementById('sso-email').value = state.ssoUserEmail || '';
      document.getElementById('sso-email-msg').textContent = '';
      document.getElementById('sso-overlay').style.display = 'flex';
      setTimeout(function () { document.getElementById('sso-email').focus(); }, 80);
    }

export function ssoBack() {
      document.getElementById('sso-step-email').style.display = '';
      document.getElementById('sso-step-code').style.display = 'none';
      document.getElementById('sso-email-msg').textContent = '';
      document.getElementById('sso-code-msg').textContent = '';
    }

export function sendOtp() {
      var email = document.getElementById('sso-email').value.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        document.getElementById('sso-email-msg').innerHTML = '<span style="color:#e53e3e;">Please enter a valid email address.</span>';
        return;
      }
      var btn = document.getElementById('sso-send-btn');
      btn.disabled = true; btn.textContent = 'Sending…';
      document.getElementById('sso-email-msg').textContent = '';
      state.ssoEmailPending = email;
      // Gate: only emails in the users table can receive OTP
      sb.from('users').select('id').eq('email', email).maybeSingle().then(function(uRes) {
        if (uRes.error || !uRes.data) {
          btn.disabled = false; btn.textContent = 'Send authorization code';
          document.getElementById('sso-email-msg').innerHTML = '<span style="color:#e53e3e;">This email is not registered in the system. Contact your administrator.</span>';
          return;
        }
        sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }).then(function(res) {
          if (res.error) {
            btn.disabled = false; btn.textContent = 'Send authorization code';
            document.getElementById('sso-email-msg').innerHTML = '<span style="color:#e53e3e;">' + res.error.message + '</span>';
            return;
          }
          // 60-second cooldown to prevent OTP spam
          var countdown = 60;
          btn.disabled = true; btn.textContent = 'Resend in ' + countdown + 's';
          var cooldownTimer = setInterval(function () {
            countdown--;
            if (countdown <= 0) {
              clearInterval(cooldownTimer);
              btn.disabled = false; btn.textContent = 'Send authorization code';
            } else {
              btn.textContent = 'Resend in ' + countdown + 's';
            }
          }, 1000);
          document.getElementById('sso-step-email').style.display = 'none';
          document.getElementById('sso-code-hint').textContent = 'A 6-digit code was sent to ' + email + '. Check your inbox and enter it below.';
          document.getElementById('sso-step-code').style.display = '';
          document.getElementById('sso-code').value = '';
          document.getElementById('sso-code-msg').textContent = '';
          setTimeout(function () { document.getElementById('sso-code').focus(); }, 80);
        });
      });
    }

var _verifyingOtp = false;
export function verifyOtp() {
      if (_verifyingOtp) return;
      var code = document.getElementById('sso-code').value.trim();
      if (!code || code.length < 6) {
        document.getElementById('sso-code-msg').innerHTML = '<span style="color:#e53e3e;">Enter the 6-digit code from your email.</span>';
        return;
      }
      _verifyingOtp = true;
      var btn = document.getElementById('sso-verify-btn');
      btn.disabled = true; btn.textContent = 'Verifying…';
      document.getElementById('sso-code-msg').textContent = '';
      sb.auth.verifyOtp({ email: state.ssoEmailPending, token: code, type: 'email' }).then(function(res) {
        if (res.error) {
          _verifyingOtp = false;
          btn.disabled = true; btn.textContent = 'Verify & sign in';
          document.getElementById('sso-code-msg').innerHTML = '<span style="color:#e53e3e;">' + res.error.message + '</span>';
          document.getElementById('sso-code').value = '';
          return;
        }
        // Fetch display_name and role from users table
        sb.from('users').select('display_name, name, role').eq('email', state.ssoEmailPending).maybeSingle().then(function(uRes) {
          var u = uRes.data || {};
          state.ssoUserName = u.display_name || u.name || state.ssoEmailPending;
          state.ssoUserEmail = state.ssoEmailPending;
          
          // Read authoritative role from the secure JWT, not sessionStorage
          sb.auth.getUser().then(function(authRes) {
            var authUser = authRes.data && authRes.data.user;
            state.ssoUserRole = (authUser && authUser.app_metadata && authUser.app_metadata.role) || 'User';
            
            sessionStorage.setItem(state.SSO_USER_KEY, state.ssoUserName);
            sessionStorage.setItem(state.SSO_EMAIL_KEY, state.ssoUserEmail);
            // intentionally omitted state.SSO_ROLE_KEY — do not store role in sessionStorage
            
            applySsoUser();
            document.getElementById('sso-overlay').style.display = 'none';
            var nameEl = document.getElementById('cv-active-name');
            if (state.countSessId) {
              var sess = state.S.find(function (s) { return s.id === state.countSessId; });
              if (sess) nameEl.textContent = sess.name + ' (' + sess.entity + ')  ·  ' + state.ssoUserName;
            }
            if (state.ssoUserRole === 'Admin') { goSessions(); } else { goCount(); }
          });
        });
      });
    }

export function signOut() {
      if (!confirm('Sign out of StockTake Pro?')) return;
      state.ssoUserName = ''; state.ssoUserEmail = ''; state.ssoUserRole = 'User';
      sessionStorage.removeItem(state.SSO_USER_KEY);
      sessionStorage.removeItem(state.SSO_EMAIL_KEY);
      // clean up legacy role key if it exists
      try { sessionStorage.removeItem('stp_sso_role'); } catch(e) {}
      try { sessionStorage.removeItem('state.SSO_ROLE_KEY'); } catch(e) {}
      sb.auth.signOut().catch(function () { });
      applySsoUser();
      showSsoOverlay();
    }

// --- Global Window Exports ---
window.getSsoInitials = getSsoInitials;
window.applySsoUser = applySsoUser;
window.checkLogin = checkLogin;
window.showSsoOverlay = showSsoOverlay;
window.ssoBack = ssoBack;
window.sendOtp = sendOtp;
window.verifyOtp = verifyOtp;
window.signOut = signOut;
