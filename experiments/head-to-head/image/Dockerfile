# Run image for the head-to-head experiment (docs/head-to-head.md,
# "Isolation"): one agent, one run. A fresh home with no user CLAUDE.md,
# memory or plugins; the only project content is what the runner mounts at
# /work. The network is not this file's job: run containers sit on an
# internal network whose only exit is the allowlist proxy (../proxy).
FROM node:22-bookworm-slim

# Pinned to the host CLI the experiment was built against. Record a change in
# the run log: a different CLI is a different instrument.
ARG CLAUDE_CODE_VERSION=2.1.293

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# TypeScript tooling for implementers, installed now because npm's registry
# is not on the allowlist at run time.
RUN npm install -g \
      @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
      typescript@6.0.3 \
      tsx@4.22.4 \
 && npm cache clean --force

COPY --chown=node:node settings.json /home/node/.claude/settings.json

ENV DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

LABEL centina.h2h.claude-code-version=${CLAUDE_CODE_VERSION}

USER node
WORKDIR /work
