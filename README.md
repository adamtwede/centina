# Centina

> Most building traditions have a word for the temporary frame that holds an
> arch in shape while it's under construction, until its keystone locks and
> the frame can be struck: the frame that teaches the arch its shape until it
> can stand alone. German calls it *Lehrgerüst* — literally "teaching frame."
> French calls it *cintre*; Spanish, *cimbra*. This project takes its name
> from the Italian term, *centina* — the word that named the frames behind
> Brunelleschi's dome and the rest of the Renaissance's structural
> ambition, an engineering discipline in its own right rather than incidental
> carpentry.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/falsework-dark.svg">
    <img src="docs/assets/falsework.svg" width="640"
         alt="An arch with a highlighted keystone at its apex, resting on a temporary centering frame — the falsework — that teaches the arch its shape until the keystone locks it and the frame can be struck.">
  </picture>
</p>

**Centina** is spec-flavored TypeScript: a medium for writing structured, rule-checked pseudocode, i.e., *falsework*, for a coding task before it is built. TypeScript supplies the grammar and the expressiveness; a spec-plane checker, not the TypeScript compiler, is the arbiter of "done." A Centina spec is built first and checked for structure, so it teaches the implementation its shape, and it is up front about being scaffolding rather than product.

## Documentation

The full documentation is at **[adamtwede.github.io/centina](https://adamtwede.github.io/centina/)**: why this exists, the concepts, install, a quickstart, the vocabulary, and the design rationale.

## Install

Centina is a Claude Code plugin. From a clone of this repo:

```console
node install.mjs
```

This copies the plugin to `~/.claude/skills/centina/`, which Claude Code loads in every session. Then start Claude Code in the project you want to spec and run `/centina-session-zero`. For other harnesses, or setups without Claude Code, see the [install pages](https://adamtwede.github.io/centina/install-other-harnesses).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
