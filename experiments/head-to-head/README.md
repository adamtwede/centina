# Head-to-head harness

The isolation and run tooling for `docs/head-to-head.md`. The design, and the
reasons for each control, are in that doc's "Isolation" and "Authentication"
sections; this file is how to run it. Hidden materials (intent documents,
traces, reference implementations, the trace suite, canary lists) never live
here: they belong in the private repo. Run output goes to `runs/`, which is
gitignored.

## One-time setup

1. Run `claude setup-token` yourself and save the token it prints to
   `~/.centina-h2h/oauth-token` (or set `CENTINA_H2H_TOKEN_FILE` to another
   file outside every repo). Nothing here prints it, and run output is
   scrubbed for it.
2. Build the images and start the proxy:

   ```bash
   node experiments/head-to-head/net.mjs build
   node experiments/head-to-head/net.mjs up
   ```

3. Run the escape test. Repeat it after every image build and every change
   to the proxy or the networks. Every check must pass:

   ```bash
   node experiments/head-to-head/escape-test.mjs
   ```

## The pilot

One trivial run, to find which hosts subscription authentication needs:

```bash
node experiments/head-to-head/run.mjs --manifest experiments/head-to-head/pilot/manifest.json --prompt experiments/head-to-head/pilot/prompt.md --id pilot-1
```

```bash
node experiments/head-to-head/net.mjs hosts
```

If the run fails and `hosts` shows a denied host the CLI needs, add the
smallest pattern that admits it to `proxy/allowlist`, rebuild, rerun the
escape test, and record the change in the doc's log.

## A run

```bash
node experiments/head-to-head/run.mjs --manifest <manifest.json> --prompt <prompt.md>
```

```bash
node experiments/head-to-head/audit.mjs <run dir> --canaries <canaries.txt>
```

`run.mjs` exits non-zero unless the run completed; `meta.json` says why
(`usage-limit`, `timeout`, `error`, `no-result`). A run that didn't complete
is never scored. `audit.mjs` exits non-zero on a leak (a canary found, or a
web tool used), and the run is discarded; `attempt` findings are blocked
reaches for the network or the host, recorded for a human to read.

## Files

| File | What it does |
| --- | --- |
| `image/` | The run image: Node, the pinned Claude CLI, TypeScript tooling, a fresh home whose settings deny the web tools |
| `proxy/` | The allowlist proxy, the internal network's only exit |
| `net.mjs` | Builds the images; starts and stops the proxy and networks; lists the hosts it saw |
| `escape-test.mjs` | The isolation's positive control |
| `run.mjs` | One headless run from a manifest and a prompt |
| `audit.mjs` | The tool-call audit and canary scan for one run |
| `pilot/` | The pilot task |
| `probe/contract.ts` | The hill-climbing probe's I/O contract, given word for word to every implementer |
| `probe/sources.mjs` | Builds the probe's three sources and their manifests from the freeze commit; `--check` verifies them |
| `probe/sources/` | The built sources (prose, no-fill, filled), each with a `manifest.json` for `run.mjs` |
| `probe/prompt.md` | The one implementer prompt, for every source: build `loop.ts`, raise doubts in `/work/NOTES.md` |
