# Ueat AI Workflow Prompt Template

## 1. Purpose

This document defines the standard prompt template used for interacting with AI tools such as Codex, ChatGPT, or other AI assistants in the Ueat project.

It ensures:
- Consistency across all AI-generated outputs
- Alignment with project documentation
- Prevention of hallucinated or inconsistent features
- A structured AI-assisted software engineering workflow

---

## 2. Core Principle

All AI interactions MUST follow this structure:

> Base Context (fixed) + Task (variable)

- The Base Context defines the project background, positioning, rules, and constraints.
- The Task defines what the AI should do in the specific request.

---

## 3. Base Prompt (DO NOT MODIFY)

This section must be used in every AI request.

```text
You are working inside the Ueat (Campus Meal Companion System) project.

## Project Positioning
Ueat uses meal companionship as the initial low-pressure entry point for campus offline interaction.

The project goal is broader than simply arranging meals. Ueat uses eating together as a natural and low-pressure scenario to help students reduce loneliness, meet new people, build meaningful campus connections, and gradually support follow-up interaction through later use cases.

Ueat is NOT:
- a dating application
- a general-purpose social network
- a pure chat application
- an app where the interaction simply ends after eating together

Ueat IS:
- a campus-oriented offline interaction system
- a structured way to lower the barrier to first-time meetings between students
- a system that may gradually support trust, safety, feedback, follow-up interaction, and longer-term connection development when justified by /docs and use cases

## Source of Truth
Always use the /docs directory as the ONLY source of truth.
Do not invent or assume missing information.

Key documents:
- 00_Project_Context.md
- 01_Pre-Full_Conversation_summary.md
- 02_Questionnaire.md
- 03_AI_Workflow_Prompt_Template.md
- 04_Archive.md

## Rules
- Maintain consistency with the existing project scope
- Do NOT introduce features without justification from /docs
- Focus on system-level software engineering design
- Avoid hallucination or speculative assumptions
- Treat meal matching as the entry scenario, not the final limit of the product
- Any expansion beyond meal matching must be supported by /docs, user research, or later use case documentation
- Do not turn Ueat into a dating app, general social platform, or pure chat product
```

---

## 4. Task Template (VARIABLE PART)

Use the following structure after the Base Prompt.

```text
## Task
{Describe the specific task here.}

## Input Materials
{Paste any additional user-provided materials, drafts, requirements, attachments, or notes here. If there are none, write "None".}

## Expected Output
{Describe the required output format, such as Vision document, PRD, use cases, UI structure, architecture design, implementation plan, or Codex development prompt.}

## Constraints
- The output must follow /docs as the only source of truth
- The output must stay within the Ueat project scope
- The output must not introduce unsupported features
- Missing information must be clearly marked instead of invented
- All assumptions must be explicitly labeled

## Quality Checklist
- Consistent with Ueat project positioning
- Reusable and modular
- Engineering-grade
- Clear enough for software engineering collaboration
- Suitable for direct use in Codex / ChatGPT / AI tools
```
