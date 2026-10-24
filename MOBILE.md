# Phone app candidate: 0.3.0

Status: LOCAL CANDIDATE, NOT DEPLOYED. The stable public release remains v0.2.0.

This adds an installable web-app shell and an opt-in connection to the existing Windows studio. It is not a native iOS binary, and the Windows executable is not installable on iOS.

## Intended use

Once the HTTPS relay is deployed and its owner configuration is installed, open the hosted site in Safari and use Share > Add to Home Screen > Open as Web App. Pair from the desktop's Phone connection button using its single-use fifteen-minute link. The phone can then use the same library, scripts, comparisons and results as the desktop. Video uploads are sent in 1 MiB chunks to the Windows queue. Analysis runs on that computer, not on the phone.

The computer must be awake, online and running this app for live work. Nothing installs an autostart service or changes the firewall. Close the app to stop its relay polling. Disabling phone access revokes sessions before reporting success; if revocation cannot be confirmed the UI says so. An already dispatched operation may finish.

## Offline use

Open a filming brief, then Phone & offline > Save open filming brief on this phone. The app stores that chosen HTML copy in IndexedDB. The public shell is cached by a service worker; private API responses, videos and session endpoints are not cached. Saved briefs open in a script-disabled frame. Browser storage can be cleared or evicted; it is not a backup guarantee. Keep original briefs on the desktop and export important work.

Live writes are not silently queued while offline. After a connection failure, reopen the library or queue before retrying a change. The desktop journal records mutation identities and refuses unknown-outcome replay. Upload chunks validate their offsets and reject conflicting repeated bytes; final submission has an explicit receipt.

## Security and privacy model

- Desktop API remains bound to 127.0.0.1. There is no inbound port, arbitrary proxy target, filesystem browser, terminal or command execution interface.
- A dedicated Cloudflare Worker and SQLite-backed Durable Object relay only an explicit subset of application routes. Model configuration and desktop pairing controls are excluded from remote access.
- The desktop starts outbound HTTPS polls. Media, transcripts, scripts and metrics pass transiently through Cloudflare. This is TLS transport encryption, NOT end-to-end encryption. The relay operator is trusted with that traffic.
- The cloud stores hashed pairing/session verifiers and device metadata, not the media library. Pairing is atomic and single use. Browser sessions use Secure, HttpOnly, SameSite=Strict cookies and expire after thirty days; the desktop can revoke them.
- Paired devices can read and edit the whole studio, not just one research project. Pair trusted devices only. The hosted deployment is owner-scoped, not a public multi-tenant service.
- Offline copies remain on the paired device until removed. Forget this device removes offline copies after online logout. Revoking a lost device cannot remotely erase files already saved to it.
- The executable contains no owner bridge secret. mobile-connection.json belongs only in the owner's application data directory and is not committed or packaged. No cloud-model calls, platform connections, credentials or model downloads are enabled.

## Hosting preparation

scripts/build_mobile.py creates mobile-dist from an explicit public-file list. cloud/wrangler.json configures a new, separate worker named reel-anatomy; it does not modify the user's other sites. The worker needs a BRIDGE_SECRET binding containing a newly generated 256-bit random secret. The desktop owner's private configuration contains the matching secret, the exact HTTPS deployment origin, and an enabled boolean. Provision those only through an approved secret-management route. Do not put secrets in client JavaScript, source control, command-line values or public artifacts.

Cloudflare hosting has its own quotas and billing. This candidate changes no subscription or spending limit. Polling uses a twenty-second idle wait with bounded backoff; app-private data is not persisted by the relay. Production load, latency and authenticated phone-browser acceptance are still open.

## Verification achieved

Local relay contract tests cover unauthenticated denial, one-time pairing, secure cookie attributes, concurrent token consumption, origin checks, dispatch/reply matching and device revocation. Desktop tests cover chunk handling, duplicate-write receipts, unknown-outcome non-replay and disabled defaults. Public-shell browser tests use generated offline content, not private owner data. The desktop's existing media and Studio browser workflows also pass.

These are different evidence classes. A successful protocol test is NOT a claim that the deployed phone workflow or physical Safari device was tested.

## Outstanding acceptance and tool boundaries

Owner: Ultron Prime. Milestone: approved hosting deployment plus real authenticated phone acceptance.

During this implementation the tool safety checks blocked (1) a combined authenticated-browser test-script write and (2) the Bifrost start_process request for Wrangler deployments list with cloud/wrangler.json. Neither blocked operation was replayed; no alternate tool or service was used to bypass the boundary. Public-only local browser checks continued. No production worker, secret or live phone URL was created.

Remaining checks: deploy through an allowed route; verify actual HTTPS response headers; provision a private owner connection; test pairing, editing, chunked upload, reconnect and revocation across the actual hosted relay; install and exercise on a physical iPhone; check Safari foreground/background upload behavior; validate Apple HEVC/MOV playback using authorised samples. Do not call the phone delivery complete until these pass.

Official references: Apple Support, Turn a website into an app in Safari on iPhone (https://support.apple.com/guide/iphone/iphea86e5236/ios); Cloudflare static assets (https://developers.cloudflare.com/workers/static-assets/binding/) and Durable Objects limits (https://developers.cloudflare.com/durable-objects/platform/limits/).
