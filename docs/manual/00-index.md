---
title: Introduction
slug: introduction
description: What the Solercia design system is, who it is for and how to read this manual.
---

# Solercia Design System

<p align="center"><img src="../../.github/assets/solercia-mark.svg" alt="Solercia" width="48" height="92"></p>

The Solercia design system is the set of packages, contracts and rules that Solercia Solutions uses to
build Angular applications for several organizations from one code base. It answers three questions
for every screen: which component to use, how it looks for the active organization, and where the
code that uses it belongs.

```bash
ng add @solercia/ui
```

That single command installs the component library, applies the default theme, scaffolds a
Feature-Sliced Design (FSD) project structure and turns the architecture rules into lint rules.

## What it is made of

| Package | Role | Source |
| --- | --- | --- |
| `@solercia/ui` | Angular 22 component library: 57 standalone components and directives, theme runtime, i18n contract, `ng add` and generators. | [solercia-ui](https://github.com/solercia-solutions/solercia-ui) |
| `@solercia/eslint-config` | ESLint flat config that enforces FSD boundaries, file placement and token-only styling. | [eslint-config](https://github.com/solercia-solutions/eslint-config) |
| `@solercia/chat` | Embeddable AI assistant chat (streamed answers, sources, history) that reads the same tokens. | [solercia-chat](https://github.com/solercia-solutions/solercia-chat) |

## Who it is for

- **Application developers** building screens: start with [Getting started](./03-getting-started.md),
  then [Patterns](./07-patterns.md).
- **Architects and reviewers** deciding how a project is organized: read [Principles](./01-principles.md),
  [Architecture](./02-architecture.md) and [Linting and architecture rules](./08-linting-and-architecture-rules.md).
- **Designers and brand owners** defining how an organization looks: read [Theming](./04-theming.md).
- **AI coding agents** generating code with the library: read [For AI agents](./10-for-ai-agents.md), or
  load the whole manual at once from [`llms-full.txt`](../../llms-full.txt).

## How to read this manual

Each chapter stands on its own and opens with an example. Chapters explain the reasoning and the
contracts; the exhaustive list of inputs and outputs of every component lives in one place, the
[component reference](../../README.md#component-reference), and every component has a live demo in the
showcase application.

| Chapter | Read it when you need to |
| --- | --- |
| [01 Principles](./01-principles.md) | Understand the decisions behind the system. |
| [02 Architecture](./02-architecture.md) | See how the packages, ports and layers fit together. |
| [03 Getting started](./03-getting-started.md) | Create a new project or adopt the library in an existing one. |
| [04 Theming](./04-theming.md) | Brand an application or support several organizations. |
| [05 Internationalization](./05-i18n.md) | Translate the components or plug in your i18n engine. |
| [06 Components](./06-components.md) | Find the right component for a job. |
| [07 Patterns](./07-patterns.md) | Build screens: states, forms, tables, dialogs, charts, kanban. |
| [08 Linting and architecture rules](./08-linting-and-architecture-rules.md) | Know what the linter enforces and how to declare an exception. |
| [09 Chat](./09-chat.md) | Embed the AI assistant chat. |
| [10 For AI agents](./10-for-ai-agents.md) | Prompt an agent or review its output. |
| [11 Releases and contributing](./11-releases-and-contributing.md) | Change the library and publish a version. |
| [12 FAQ](./12-faq.md) | Find quick answers. |

## Where the documentation lives

The Markdown files in `docs/manual/` are the single source. They are published three ways:

- **Website**: the *Guides* section of the showcase, next to the live demos.
- **AI file**: [`llms-full.txt`](../../llms-full.txt) at the repository root, with every chapter and the
  component reference in one plain-text file; [`llms.txt`](../../llms.txt) is the short index.
- **Manual**: a PDF and a Word document generated with `npm run docs:manual`.

Change the Markdown and the three outputs follow.
