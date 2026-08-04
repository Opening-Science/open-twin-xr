# Deploying a private preview

Static build plus atlas assets on a small VPS, behind a login wall.

**Build on your machine, serve from the server.** The split is not arbitrary — the
two jobs have completely different requirements, and the measurements are in "Why the
server can be small" below.

> ⚠️ **This document deliberately names no hosts, addresses or accounts.** Substitute
> your own for `$DEPLOY_HOST` and `$SITE` throughout. An earlier revision documented one
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

```bash
# app
rsync -avz --delete dist/ "$DEPLOY_HOST":/srv/opentwin/dist/

# assets — only the .ao.glb the app actually loads, ~57 MB total.
# NOT the raw/.opt intermediates: hundreds of MB and never requested.
rsync -avz public/models/*.ao.glb public/models/ct-atlas-f.glb \
  "$DEPLOY_HOST":/srv/opentwin/dist/models/

# the credits travel with the assets — they are a licence condition, not a nicety
rsync -avz docs/LICENCE_LOG.md ASSETS_LICENSE.md "$DEPLOY_HOST":/srv/opentwin/dist/
```

## 3b. The decision taken on the first gated deploy, 29 July 2026

Recorded because it was a knowing risk rather than an oversight, and because the same
decision must **not** be taken again for a public release.

**Nothing was withheld.** The rsync above lists only `.ao.glb` plus `ct-atlas-f.glb`; the
deploy shipped **all ten assets**, including the two the register flags:

| asset | flag | why it shipped anyway |
|---|---|---|
| `biv-heart` | `publishable: false` — subject provenance unconfirmed upstream | The audience was gated and named. The risk was accepted knowingly, and the biv-me email is still owed. |
| `ct-atlas-f` | licence unresolved — source scan never recorded | Same. ⚠️ Do **not** carry this decision into a public release. |

⚠️ **The one thing the gate did NOT relax is the unlicensed white matter.** No audience
makes geometry servable when no grant exists, so Z-Anatomy was rebuilt with
`--publishable` first.

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
