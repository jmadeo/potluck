# Christmas Potluck sign-up — Thursday, December 24 · Christmas Eve

Live site: https://jmadeo.github.io/potluck/
Static page (GitHub Pages) + a Google Sheet as the shared list. Guests need no account.

## Backend — Google Sheet + Apps Script
1. In the Sheet: **Extensions → Apps Script**, replace all code with `Code.gs`, save.
2. Host password (once): **Project Settings (⚙) → Script Properties → Add script property**
   `ADMIN_KEY` = a password you choose.
3. **Deploy → Manage deployments → ✏ → Version: New version → Deploy**
   (Execute as: Me · Who has access: Anyone). Authorize Gmail sending when asked.

## Host section (invitations)
- Open https://jmadeo.github.io/potluck/#admin (or click "Host" at the bottom), enter the password.
- Paste email addresses, add an optional note, **Send invitations**. Emails go out from your Gmail
  (about 100/day limit) and are logged in the **Invites** tab of the Sheet.
- While unlocked you can also remove any dish.

## Notes
- Guests can remove only dishes they added (remembered in their browser).
- You can also edit/delete rows directly in the Sheet.
- The page refreshes the list every 20 s.
