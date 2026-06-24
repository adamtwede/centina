# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository is in its earliest pre-implementation stage. There is no source code, build, lint, or test tooling yet — `PLAN.md` is a one-line placeholder, and the `SPEC.md` and `ARCHITECTURE.md` files it refers to do not exist yet. Do not assume any of these scaffolding pieces exist; check before referencing them.

## What this project is

AISL (Agent-Interpreted Specification Language) is a DSL for writing high-level, structured pseudocode that a human authors and a coding model (e.g. Claude) iterates on with them until it reaches a shared understanding, which is then turned into an implementation plan. The goal is to replace ad-hoc conversation-first planning with a more structured artifact that:

- enforces naming consistency and reduces ambiguity in the pseudocode itself
- gives the coding model clearer guardrails to interpret correctly
- pushes the human to think through design decisions up front rather than offloading that thinking to the model

## How to run

`npm run check spec_file.aisl`

## Working in this repo

Since there is no implementation yet, most work here will be specification and design (writing/refining `SPEC.md`, `ARCHITECTURE.md`, `PLAN.md`) rather than code. When asked to implement something, first confirm whether the relevant spec/architecture documents exist and are settled — building ahead of the spec defeats the purpose of this project.
