# Deploying a private preview

Static build plus atlas assets on a small VPS, behind a login wall.

**Build on your machine, serve from the server.** The split is not arbitrary — the
two jobs have completely different requirements, and the measurements are in "Why the
server can be small" below.

> ⚠️ **This document deliberately names no hosts, addresses or accounts.** Substitute your
> own for `$DEPLOY_HOST`, `$DEPLOY_USER`, `$SITE` and `$VERIFY_URL` throughout. An earlier
> revision documented one
> specific deployment, including its public and tailnet addresses and the other services
> sharing the box; that is a map of someone's infrastructure and does not belong in a
> repository, private or otherwise. Everything that was *reasoning* has been kept.
>
> Keep the real values where secrets already live — a password manager, or your own
> operations notes. Not here.

---

## ⚠️ Read before the first deploy

**Serving to logged-in users is distribution.** A login wall limits *who* sees the
preview; it does not change what may lawfully be sent to them. Three things follow, none
of which auth relaxes:

1. **The University of Washington white matter must not go up.** It carries no licence
   statement, and silence grants nothing — attribution answers a licence's conditions, it
   cannot create a grant. Build with `--publishable`, which drops it and nothing else
   (see below).
2. **The Z-Anatomy-derived GLB is CC BY-SA.** Share-alike attaches to the *adapted* work,
   so once it is being distributed it has to be redistributable under the same terms,
   with attribution and an indication of changes.
3. **It carries CC BY-NC and CC BY-NC-SA components**, so the bundle is **open source,
   non-commercial** — not Open Definition conformant. Say that plainly wherever the
   preview is described. Do not badge it CC BY-SA and leave it there.

`npm run check:licences` prints the current position and regenerates
`docs/LICENCE_LOG.md`. **Read the action list before each deploy, not once.** It
currently carries two items that block a *public* release — see
[`reports/06-app-store-publication.md`](reports/06-app-store-publication.md) §3.

---

## 1. Build the assets — on your machine

```bash
npm run build:z-anatomy -- --src ~/Downloads/z-anatomy-fbx --publishable
npm run convert:z-anatomy
npm run convert:z-anatomy-regions
npm run check:winding && npm run check:structures && npm run check:licences
```

**`--publishable` is the flag that matters.** It drops components with no licence
statement and leaves everything else — the non-commercial components stay, because
non-commercial is compatible with this project's stance and they need attribution, not
removal. Without it you get the full research build, which is correct locally and
unlawful to serve.

Confirm the roll-call reads `0 structures NONE STATED ... excluded by --publishable`
before shipping:

```
0 structures  NONE STATED   Brainder / White matter (University of Washington)
                            <- excluded by --publishable
```

`bodyparts3d`, `hra` and `hra-m` have no unlicensed components, so their existing
`.ao.glb` builds can go up as they are.

⚠️ Rebuilding also refreshes the component tags, which only change on a rebuild. That is
how the Dundee inner-ear tag went from 8 structures to **4** — cochlea and vestibule per
side, dropping the tympanic membrane and auditory tube, which are MIDDLE ear and were
being over-attributed. 3,617 structures became 3,614. If your counts differ from
`LICENCE_LOG.md`, the log is right and your build is stale.

## 2. Build the app

```bash
npm run build     # tsc + vite; prunes unshipped models from dist automatically
```

## 3. Ship it

`public/models/*.glb` is gitignored, so **`git pull` on the server gets the app and none
of the geometry.** The assets need their own path across. The app degrades honestly if
they are missing — procedural body, switcher says "not installed" — so a half-finished
deploy is visibly wrong rather than subtly wrong.

### The app

```bash
rsync -az --delete \
  --exclude='models/' \
  --exclude='LICENCE_LOG.md' --exclude='ASSETS_LICENSE.md' \
  --exclude='ONTOLOGY_MAP.md' --exclude='STACK_AND_MODELS.md' \
  dist/ "$DEPLOY_USER@$DEPLOY_HOST":/srv/opentwin/dist/
```

⚠️ **The four exclusions are not tidiness. Each prevents a specific, silent loss —
and an earlier revision of this document omitted all of them.**

**`--exclude='models/'` — without it a deploy from a clean clone deletes every atlas.**
`dist/models` is populated by Vite copying `public/models/`, so it holds the ten shipped
assets (~96 MB) when you build from a checkout that *has* them. Build from a fresh clone
of the repository and the same directory is **empty**, because the assets are gitignored
by design — so `--delete` reads the server's 97 MB of anatomy as strays and removes it.
The site would come back up on the procedural placeholder with every pill reading "not
installed": honest, and a 97 MB restore. Excluding the path removes the failure mode
whichever checkout you deploy from.

**The three `.md` exclusions — without them `--delete` strips the attribution.** Those
files live in the webroot but are not part of `dist/`, so `--delete` treats them as
strays too. **They are a licence condition:** CC BY and CC BY-SA both require attribution
to accompany the distributed work, and the served site is the distribution. Losing them
is not a cosmetic regression. Measured on a real deploy — the dry run listed all four for
deletion before the exclusions were added.

⚠️ **`--dry-run` first, every time, and read the `*deleting` lines.** That is what caught
this. `--itemize-changes` makes the output legible:

```bash
rsync -az --delete --exclude='models/' ... --itemize-changes --dry-run \
  dist/ "$DEPLOY_USER@$DEPLOY_HOST":/srv/opentwin/dist/ | grep deleting
```

Only stale hashed `assets/*` chunks from the previous build should appear.

### The assets, when they have actually changed

Only needed after a rebuild. Check first — if the `.ao.glb` mtimes predate the last
deploy, skip this entirely and save ~97 MB of transfer.

```bash
rsync -az public/models/*.ao.glb public/models/ct-atlas-f.glb \
  public/models/biv-heart.glb public/models/eye.glb \
  public/models/openear-zeta.glb public/models/htb-ct-003.glb \
  public/models/anny-*.glb \
  "$DEPLOY_USER@$DEPLOY_HOST":/srv/opentwin/dist/models/
```

**Only what the app loads. NOT the `.raw`/`.opt`/`.stripped` intermediates** — hundreds
of megabytes, never requested. `npm run build` already prunes them from `dist`; this list
is the same set, spelled out because the rsync bypasses `dist`.

⚠️ **THIS HAND-KEPT LIST IS THE WEAK POINT, AND IT HAS ALREADY BEEN WRONG ONCE.** The five
`anny-*.glb` body envelopes (D16) were added on 8 August 2026 and were missing here — so a
deploy would have shipped the app with the envelope feature live and its assets absent,
and the failure would have been *honest but silent*: five pills reading "not installed",
exactly as a missing atlas presents.

**The reliable move is to copy what the build actually produced**, since `npm run build`
has already pruned `dist/models` down to precisely the shipped set:

```bash
rsync -az dist/models/ "$DEPLOY_USER@$DEPLOY_HOST":/srv/opentwin/dist/models/
```

That cannot drift, because the prune is driven by the registries themselves. Prefer it;
the explicit list above is kept only for the case where you are shipping assets without a
fresh build. **If you do use the explicit list, cross-check it against `ls dist/models/`
first.**

### The credits

```bash
rsync -az docs/LICENCE_LOG.md docs/ONTOLOGY_MAP.md docs/STACK_AND_MODELS.md \
  ASSETS_LICENSE.md "$DEPLOY_USER@$DEPLOY_HOST":/srv/opentwin/dist/
```

Push these whenever `check:licences` regenerates the log, so the served attribution
matches the served geometry.

### `$DEPLOY_USER` is an unprivileged account, and must stay one

**Confirm the account before assuming it.** A `ssh … 'whoami'` costs nothing; discovering
it mid-rsync costs a failed deploy. An earlier revision hardcoded `deploy@` at a time when
that account did not exist, and the deploy in fact ran as `root`.

⚠️ **It runs as `root` no longer, and it must not go back.** The webroot is owned by an
unprivileged user that is deliberately:

- **not in sudoers** — verified with `sudo -l -U`, not inferred from group membership,
  because `sudo -n` answers "a password is required" for a non-sudoer too and that reads
  like an escalation path when it is not one
- **password-locked** (`passwd -l`), so there is no secret to phish or brute force
- **the owner of `/srv/opentwin`**, which is all it needs

The reasoning is not abstract. A deploy that only writes one directory should not hold the
whole machine — and it matters more the moment the key stops living on one laptop. Putting
a **root** key into CI secrets would turn "repository write access" into "the server";
putting this one there grants exactly the ability to replace static files.

⚠️ **Related, and easy to miss:** running the rsync as root with `-a` preserved the
*client's* numeric ownership, so the webroot ended up owned by uid `501:staff` — a macOS
UID with no meaning on a Linux box. As an unprivileged user rsync cannot set ownership at
all, so this stops happening by construction. Caddy reads the tree as its own user, so
directories are `755` and files `644`.

⚠️ **If the tailnet name does not resolve, use the tailnet address.** MagicDNS was not
resolving the host on a machine whose tailnet was otherwise up and listing peers
normally; the address worked immediately. Not worth debugging mid-deploy.

## 3b. The decision taken on the first gated deploy, 29 July 2026

Recorded because it was a knowing risk rather than an oversight, and because the same
decision must **not** be taken again for a public release.

**Nothing was withheld.** The deploy shipped **all ten assets**, including the two the
register flags:

| asset | flag | why it shipped anyway |
|---|---|---|
| `biv-heart` | `publishable: false` — subject provenance unconfirmed upstream | The audience was gated and named. The risk was accepted knowingly, and the biv-me email is still owed. |
| `ct-atlas-f` | licence unresolved — source scan never recorded | Same. ⚠️ Do **not** carry this decision into a public release. |

⚠️ **The one thing the gate did NOT relax is the unlicensed white matter.** No audience
makes geometry servable when no grant exists, so Z-Anatomy was rebuilt with
`--publishable` first.

## 3c. Verify the deploy, before believing it

A deploy that rsyncs without error can still serve the previous build — a stale
`index.html`, a cached chunk, a webroot that is not the one the server reads. Check the
bytes rather than the exit code.

```bash
# 1. The bundle served is the bundle you built — the only check that cannot be fooled.
BUNDLE=$(basename dist/assets/index-*.js .js | head -1)
shasum -a 256 "dist/assets/$BUNDLE.js"
curl -s "$VERIFY_URL/assets/$BUNDLE.js" | shasum -a 256

# 2. index.html points at the new hashed names, not the old ones.
curl -s "$VERIFY_URL/" | grep -oE '(src|href)="/assets/[^"]+"'

# 3. The anatomy still serves — proves the models exclusion did its job.
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  "$VERIFY_URL/models/bodyparts3d.ao.glb"

# 4. The login wall is still up on the PUBLIC name. 401 is the pass condition.
curl -s -o /dev/null -w '%{http_code}\n' "https://$SITE/"
```

`$VERIFY_URL` is a route that reaches the site without credentials. On the current
deployment that is the tailnet HTTP route, which exists precisely so a deploy can be
verified without handling the basic-auth secret. If you have no such route, use the public
name with credentials from your password manager — but note that step 4 then needs a
separate unauthenticated request to be meaningful.

Also worth a glance in a browser: the interface should read **Open Twin XR**, the
colour-mode toggle should say **Anatomical / Metrics**, and the Look group should offer
**Glass hull** and **Stage**. If any of those read differently, the served bundle predates
D15 or the appearance work and step 1 will disagree.

## 4. DNS

Point an `A` record and, if you have IPv6, an `AAAA` record at the server before
configuring the web server. Caddy provisions TLS on first request, which needs the name
to resolve first — **so DNS before the server**, or the certificate attempt fails and
backs off with a retry delay.

## 5. Web server

Caddy over nginx here for one reason: **automatic HTTPS with no certbot cron to forget.**
WebXR requires a secure context, so TLS is not optional for the headset path — it is the
feature working at all.

```caddyfile
$SITE {
	root * /srv/opentwin/dist
	encode zstd gzip

	# The login wall. Generate the hash with `caddy hash-password` and put it in an
	# environment file — NEVER commit it.
	basic_auth {
		{$OPENTWIN_USER} {$OPENTWIN_HASH}
	}

	# GLBs are content-addressed by rebuild, not by filename, so they must revalidate.
	# Getting this wrong is not theoretical: a browser holding a cached GLB across a
	# rebuild is exactly how a fixed asset appears unfixed.
	@models path /models/*
	header @models Cache-Control "no-cache"

	# Hashed asset filenames from Vite are safe to pin hard.
	@immutable path /assets/*
	header @immutable Cache-Control "public, max-age=31536000, immutable"

	file_server
}
```

```bash
sudo systemctl edit caddy     # add OPENTWIN_USER / OPENTWIN_HASH to the unit
sudo systemctl reload caddy
```

**Credentials live in an environment file or the systemd unit, never in the repo.** The
hash is bcrypt, so it is not reversible, but it is still a credential.

⚠️ **Use an env file rather than `Environment=` lines**, because a bcrypt hash contains
`$` and systemd would mangle it. Mode `600`. This is the kind of thing that appears to
work and then fails on one particular hash.

If you are appending a virtual host to a server that already runs others, `caddy
validate` before reloading and re-check **every** site afterwards, not just the new one.

---

## Why the server can be small, and when it is not enough

A 2 vCPU / 4 GB instance is comfortable for **serving** and marginal for **building**.
All the real work happens in the visitor's browser — WebGL, the BVH build, the explode
shader, hover picking. The server hands over static files and touches no geometry.

What would change that: server-side asset conversion (the pipeline peaks well above 4 GB
and `strip-atlas` runs with `--stack-size=4000`), or the scoring tier that D8 puts
upstream, which needs somewhere to hold vendor credentials and must never be the browser.
