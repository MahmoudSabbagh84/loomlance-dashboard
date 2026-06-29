# github-webhook — owner integration verification

Prereqs: `GITHUB_WEBHOOK_SECRET` set (`supabase secrets set GITHUB_WEBHOOK_SECRET=<secret>`),
and `github-webhook` deployed with `verify_jwt = false` (`supabase functions deploy github-webhook`).

## 1. Seed a test link + task (SQL, via the dashboard SQL editor or MCP)
- Pick one of your projects (note its id, user_id, task_key) and a task in it (note its ref_number).
- Insert a project_repos row linking a fake repo to that project:
  `insert into project_repos (user_id, project_id, installation_id, repo_id, repo_full_name)
   values ('<user_id>','<project_id>', 1, 999001, 'you/test-repo');`

## 2. Send a signed `push` that completes the task
Run locally (bash); set SECRET to the webhook secret and KEY/NUM to the task's key/ref_number:
```bash
SECRET='<webhook secret>'
BODY=$(cat <<'JSON'
{"ref":"refs/heads/main","repository":{"id":999001,"default_branch":"main"},
 "commits":[{"message":"<KEY>-<NUM> done"}]}
JSON
)
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook \
  -H "x-github-event: push" -H "x-github-delivery: test-$(date +%s)" \
  -H "x-hub-signature-256: $SIG" -H "content-type: application/json" \
  --data-binary "$BODY"
```
Expected: `200`. Then confirm in the app/board that the task moved to the Done column.

## 3. Send a signed `issues` opened event
Same signing, `x-github-event: issues`, body:
`{"action":"opened","repository":{"id":999001},"issue":{"number":1,"title":"Test issue","state":"open","html_url":"https://x","labels":[],"updated_at":"2026-06-30T00:00:00Z"}}`
Expected: `200`, and a `github_issue_cards` row appears for the project. Send `{"action":"closed",...}` → the row is deleted.

## 4. Cleanup
`delete from project_repos where repo_id = 999001;`
`delete from github_issue_cards where repo_id = 999001;`
