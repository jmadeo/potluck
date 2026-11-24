# Christmas Potluck sign-up

A static page (GitHub Pages) + a Google Sheet as the shared list. Guests need no account.

## 1. Backend — Google Sheet (≈3 min)
1. Create a new Google Sheet.
2. **Extensions → Apps Script**, delete the sample code, paste `Code.gs`, save.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Deploy, authorize (click "Advanced → Go to project" if Google warns), copy the **Web app URL** (ends in `/exec`).

## 2. Frontend — GitHub Pages
1. In `index.html`, replace `PASTE_YOUR_WEB_APP_URL_HERE` with that URL.
2. Upload `index.html` to your repo (root, or a `/potluck` folder).
3. Repo **Settings → Pages → Deploy from a branch → main / root** → Save.
4. Your link: `https://<username>.github.io/<repo>/` (add `potluck/` if in a subfolder).

## Notes
- Guests can remove only dishes they added (remembered in their browser).
- You moderate by editing/deleting rows directly in the Sheet.
- If you change `Code.gs` later: **Deploy → Manage deployments → Edit → Version: New version** (keeps the same URL).
- The page refreshes the list every 20 s.
