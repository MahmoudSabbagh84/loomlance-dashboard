# GitHub integration — owner setup & verification

## 1. Register the GitHub App
- GitHub → Settings → Developer settings → GitHub Apps → New App.
- Permissions: **Issues: Read-only**, **Metadata: Read-only**, **Contents: Read-only**.
- Subscribe to events: **Installation**, **Installation repositories**, **Issues**, **Push**.
- Webhook URL: `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook`; set a Webhook secret.
- Setup URL (post-install redirect): `https://app.loomlance.com/profile?tab=integrations`.
- Note the numeric **App ID**. Generate + download a **private key** (PKCS#1 PEM).

## 2. Convert the key to PKCS#8 and set secrets
```bash
openssl pkcs8 -topk8 -nocrypt -in app.private-key.pem -out app.pk8.pem
supabase secrets set \
  GITHUB_APP_ID=<numeric app id> \
  GITHUB_APP_PRIVATE_KEY="$(cat app.pk8.pem)" \
  GITHUB_WEBHOOK_SECRET=<the webhook secret>
```
(`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do not set them.)

## 3. Deploy the functions (honors config.toml verify_jwt)
```bash
supabase functions deploy github-webhook
supabase functions deploy github-connect
supabase functions deploy github-repos
supabase functions deploy github-link-repo
```

## 4. Verify the connect flow (after Plan 2d ships the UI, or via curl with a user JWT)
- Install the App on a test repo → you're redirected to `/profile?tab=integrations?installation_id=...`.
- The Integrations tab calls `github-connect` → a `github_installations` row appears for your user.
- `github-repos` lists the repo; linking it calls `github-link-repo` → a `project_repos` row + the repo's open issues appear in `github_issue_cards` (the board's Issues lane).
- Then the webhook (Plan 2b, `docs/superpowers/github-webhook-verify.md`) keeps issues + commit-completions in sync.
