# Deploying the cloud half — Cloud Run

This puts the board on the internet, behind a school-account login, so staff can
read it from home. It is **one of two independent deployments** of the same
codebase:

| | Serves | Reads | Guide |
| --- | --- | --- | --- |
| **LAN** | the corridor screens | the Sheet | [`deploy-lan.md`](deploy-lan.md) |
| **Cloud** | staff, from home | the same Sheet | this file |

They don't know about each other. Run both, or either one on its own — a school
with no corridor screens needs no LAN host, and a school that doesn't read from
home needs nothing here. Nothing below is a prerequisite for the corridor
screens, and the screens never touch this service: **the hallway stays up when
the school's internet line doesn't.**

Everything runs in `europe-west1` (St. Ghislain) below, so the data stays in
Belgium and the only processor involved is the one already holding the Sheet.

## What you need

- A Google Cloud project **inside the school's own Workspace organisation** —
  the same reason the LAN guide gives for the service account: a project outside
  it may not be allowed to see the sheet at all. Creating one inside the
  organisation may itself need a Workspace administrator.
  **Use the project the sheet's service account already lives in.** A second one
  buys nothing and reopens the sharing question this one has already answered.
  The separation worth having is between identities, not projects: the service
  account below is distinct from the LAN host's, so either can be revoked on its
  own.
- **A billing account linked to that project.** Likely the one thing the
  existing project lacks — the Sheets API is free, so nobody had to link one for
  the LAN deployment. Cloud Run refuses to deploy without it, even though this
  deployment sits inside the free tier: three
  screens' worth of traffic is a rounding error against 2 million requests a
  month. Budget a couple of euros a month and set a budget alert.
- `gcloud` on your laptop for the first deploy (`brew install --cask
  gcloud-cli`, then `gcloud auth login`). **Docker is optional** — see step 4;
  the image can be built inside Google, and every deploy after the first one is
  built by GitHub's runner anyway.
- Admin rights on the GitHub repository, for the automatic deploys at the end.

## 1. Project and APIs

`PROJECT_ID` below is a placeholder — replace it everywhere, **including inside
the service-account addresses**. A leftover `infobord-run@PROJECT_ID.iam…` fails
as a permission error on an account that doesn't exist, which reads like a
rights problem and isn't one.

```bash
gcloud config set project PROJECT_ID
```

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com sheets.googleapis.com iamcredentials.googleapis.com cloudbuild.googleapis.com
```

## 2. The identity that reads the sheet

On Cloud Run there is **no key file**. The service runs as a service account and
`google-auth-library` picks that identity up from the metadata server by itself
(`lib/sheets.ts`), so the `service-account.json` the LAN host needs has no
counterpart here — nothing to copy, nothing to rotate, nothing to leak.

```bash
gcloud iam service-accounts create infobord-run --display-name "Infobord (Cloud Run)"
```

Then **share the spreadsheet with `infobord-run@PROJECT_ID.iam.gserviceaccount.com`
as Viewer**, exactly as you did for the LAN host's service account. The two are
separate identities reading the same sheet, which is what lets you revoke one
without touching the other.

## 3. A place for the image

```bash
gcloud artifacts repositories create infobord --repository-format docker --location europe-west1
```

## 4. First deploy, by hand

This one deploy carries the settings the service keeps; the automatic deploys
later ship an image and nothing else.

**Without Docker on your laptop.** `--source .` uploads the checkout and lets
Cloud Build build this repo's Dockerfile inside your project:

```bash
gcloud run deploy infobord --source . --region europe-west1 --service-account infobord-run@PROJECT_ID.iam.gserviceaccount.com --set-env-vars SHEET_ID=YOUR_SHEET_ID,TIMEZONE=Europe/Brussels,LOCALE=nl-BE,PUPIL_DATA=reduced --min-instances 0 --max-instances 2 --memory 512Mi
```

`--source` has no way to pass a build argument, so this one image reports its
build as `los` instead of a commit. That costs nothing — the corner stamp is off
in production unless `BUILD_STAMP=on` — and the first deploy from GitHub sets it
right.

**With Docker on your laptop**, if you'd rather see the image build before it
reaches Google. `GIT_SHA` is what the corner build stamp reads; the container
has no `.git`, so without it the build calls itself `los`:

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

```bash
docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t europe-west1-docker.pkg.dev/PROJECT_ID/infobord/infobord:first .
```

```bash
docker push europe-west1-docker.pkg.dev/PROJECT_ID/infobord/infobord:first
```

Then deploy that image, with the same flags as above but
`--image europe-west1-docker.pkg.dev/PROJECT_ID/infobord/infobord:first`
in place of `--source .`.

Notes on those flags:

- **`TIMEZONE` is not optional here.** The container's clock is UTC, and every
  "now" on the board — the lesson marker, the show-windows, the standby hours —
  is computed against this value.
- **`--max-instances 2`** keeps the Sheets read quota (60 per minute per service
  account) out of reach no matter what happens.
- **`--min-instances 0`** is deliberate: the free tier covers this deployment
  comfortably, and a cold start costs a second or two on the first page of the
  morning. Set it to 1 only if that second annoys someone.
- Env vars set here **survive later deploys**. The automatic deploy at the end
  ships an image and nothing else, so a merge can never overwrite a school's own
  settings.

## 5. What `PUPIL_DATA=reduced` does

Two layers, and the second one is the one to explain to a DPO.

**Layer one — the payload.** `lib/privacy.ts` empties pupil names out of the
board data on the server, on the way out: birthdays become a count and their
classes, key duties name only the class, and notices ticked **Enkel op bord** in
the `Mededelingen` tab don't travel. Because the setting belongs to the
deployment rather than the request, no URL can talk this instance into handing
the names over.

**Layer two — never fetch them.** The sheet ranges are per deployment too, so
this instance can be told to read columns that hold no names at all:

```
BIRTHDAYS_SHEET_RANGE=Verjaardagen!C1:F1000
```

`Verjaardagen` is `Voornaam · Naam · Klas · Datum`, so `C1:F1000` returns only
the class and the date. Nothing is filtered because nothing arrived.

For `Sleutels` the same trick needs one edit in the sheet first: `Leerling` sits
in column B, and a range is a contiguous block. Move that column to the end —

```
Klas · Ophalen · Opgehaald · Terugbrengen · Teruggebracht · Leerling
```

— and then read `Sleutels!A1:E200` here. The readers match columns by header
name and ignore their order, so moving it is safe for the LAN deployment too,
which goes on reading the full width.

Set both layers. Layer two is the stronger claim; layer one is what holds the
day someone widens a range without thinking about it.

## 6. Who may look

The service is on the public internet until you put a login in front of it.
**Identity-Aware Proxy** does that with school Google accounts:

1. Console → **APIs & Services → OAuth consent screen**, if the project has none
   yet. Choose **Internal** — that alone limits sign-in to accounts in the
   school's Workspace, before any policy below is considered.
2. Console → Cloud Run → `infobord` → **Security** → enable IAP.
3. Grant **IAP-secured Web App User** to the staff Google Group — a group rather
   than 70 individuals, so joining and leaving the school does the right thing
   on its own. Console → Security → Identity-Aware Proxy → select the service →
   **Add principal**; `gcloud` can only do this for Cloud Run through its `beta`
   component, which a Homebrew-installed SDK can't add.

   **Grant the group, not the domain.** `domain:school.be` is one field instead
   of one group and looks equivalent — but where pupils hold accounts in the
   same domain it hands every pupil the home view. No names are on it, so it
   isn't a breach; it is simply a wider audience than anyone decided on, which
   is how these things usually go wrong.
4. Verify in a private window: you should get Google's login screen, sign in
   with a school account, and reach the board. Then repeat with an account
   outside the school, which should be refused. Only the pair proves anything —
   a login screen on its own says a door exists, not that it is in the right
   wall.

   After changing who may enter, wait a minute and open a **fresh** private
   window. IAM takes a moment to propagate, and the old window is still holding
   the token it was refused with, so it keeps showing "no access" long after the
   grant is correct.

Until that check passes, treat the `run.app` URL as public and don't circulate
it.

A custom domain (`infobord.school.be`) is Cloud Run → **Domain mappings**; the
certificate is automatic once the DNS record resolves.

## 7. Automatic deploys

`.github/workflows/ci.yml` deploys `main` after the typecheck and the production
build pass. It authenticates with **Workload Identity Federation**, so there is
no service-account key in GitHub either.

Create a deploy identity and let the GitHub repository impersonate it:

```bash
gcloud iam service-accounts create infobord-deploy --display-name "Infobord (GitHub deploy)"
```

```bash
gcloud iam workload-identity-pools create github --location global --display-name "GitHub"
```

```bash
gcloud iam workload-identity-pools providers create-oidc github --location global --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" --attribute-condition "assertion.repository == 'OWNER/REPO'"
```

Grant `infobord-deploy` the roles it needs — `roles/run.developer`,
`roles/artifactregistry.writer`, and `roles/iam.serviceAccountUser` on
`infobord-run` (a deploy sets which identity the service runs as, so it must be
allowed to act as that account) — and bind the pool's
`principalSet` for the repository to `roles/iam.workloadIdentityUser` on it.

Then set these **repository variables** (Settings → Secrets and variables →
Actions → Variables). The deploy job is skipped entirely when `GCP_PROJECT_ID`
is empty, which is what keeps this workflow harmless for a school that never
deploys to the cloud:

| Variable | Example |
| --- | --- |
| `GCP_PROJECT_ID` | `steiner-infobord` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `infobord-deploy@steiner-infobord.iam.gserviceaccount.com` |
| `CLOUD_RUN_SERVICE` | `infobord` |
| `CLOUD_RUN_REGION` | `europe-west1` |
| `ARTIFACT_REPOSITORY` | `infobord` |

## When something looks wrong

**gcloud says "Building using Buildpacks".** It should say "Building using
Dockerfile". Buildpacks means it found no Dockerfile in the directory you ran
from — the usual cause is running from another checkout of this repo, or from
one where the branch carrying the Dockerfile isn't checked out. `ls Dockerfile`
before deploying. A buildpack image will often build and even run, which is what
makes this worth catching: it is not the image this repo describes.

**`Permission 'iam.serviceAccounts.actAs' denied`.** First check the address in
`--service-account` is the real one and not a leftover placeholder. If it is
right, the deploying account needs `roles/iam.serviceAccountUser` on it:

```bash
gcloud iam service-accounts add-iam-policy-binding infobord-run@PROJECT_ID.iam.gserviceaccount.com --member user:YOU@school.be --role roles/iam.serviceAccountUser --project PROJECT_ID
```

**The build stamp says `los`.** The image was built without `--build-arg
GIT_SHA=...`. Harmless, but you can no longer tell which commit is live —
rebuild with it.

**A "Demo-data" badge.** `SHEET_ID` isn't set on the service, so the board is
running on `lib/demo-data.ts`. Note that the demo data reduces too, so a
reduced deployment showing "2 jarigen" with no names may still be demo data.

**"Rooster tijdelijk niet beschikbaar", and every zone empty.** The board is
reaching for a sheet it can't read. Check what the server says rather than
guessing:

```bash
gcloud run services logs read infobord --region europe-west1 --limit 30
```

- **Sheets API 404** — no such spreadsheet. Almost always `SHEET_ID` left on its
  placeholder, or an id copied with surrounding URL fragments. The id is the
  part of the sheet's URL between `/d/` and `/edit`. Fix it without rebuilding:

  ```bash
  gcloud run services update infobord --region europe-west1 --update-env-vars SHEET_ID=THE_REAL_ID
  ```

- **Sheets API 403** — the id is right and the sheet simply hasn't been shared
  with `infobord-run@PROJECT_ID.iam.gserviceaccount.com` as Viewer (step 2).
  This is the step to suspect first on a fresh project.

`--update-env-vars` changes one variable and leaves the others alone;
`--set-env-vars` would replace the whole set.

**Everything is an hour off, or the standby hours fire at the wrong time.**
`TIMEZONE` is unset and the container is running on UTC.

**Names still in the payload.** Check what the server actually sent rather than
what the page shows:

```bash
curl -s https://YOUR_SERVICE_URL/api/board | head -c 2000
```

**The board goes black at home in the evening.** That's the standby window doing
its job; the screen wakes on pointer movement, or append `?blackout=0`.

**A 403 after enabling IAP.** The account isn't in the group, or the group
hasn't been granted IAP-secured Web App User. Both are in step 6.
