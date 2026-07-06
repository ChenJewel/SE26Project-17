# Project Context – Ueat (Campus Meal Companion System)

## 0. Document Purpose

This document serves as the **entry point and source of truth** for the Ueat project.

All other documents in the `/docs` directory should be understood in relation to this file.

---

## 1. Project Overview

Ueat is a software engineering course project.

It is designed as a campus-based social interaction platform that helps university students meet new people through a simple daily activity: **sharing a meal**.

The system is NOT a dating application or a general-purpose social network.

Instead, it focuses on lowering the barrier for initial offline interaction between strangers in a campus environment.

---

## 2. Project Motivation

The idea originates from a student discussion post on Shanghai Jiao Tong University’s Shuiyuan Community.

A student proposed meeting a different stranger for dinner each day to communicate with people from different majors, backgrounds, and experiences.

Key observations from community discussions include:

- Many students experience loneliness in university life
- Social interaction often stops after exchanging WeChat contacts
- Campus social structures are relatively fixed (classes, dorms, clubs)
- Students desire new social connections but lack low-pressure opportunities
- Meaningful conversations are considered valuable
- Concerns exist about awkwardness, safety, and long-term connection maintenance

These observations are preliminary qualitative insights and require broader validation through user research.

---

## 3. Product Vision

Ueat aims to provide a **trusted, low-pressure, and campus-oriented interaction system** for students.

The goal is NOT to directly solve loneliness.

Instead, it focuses on:

- Reducing the barrier to meeting strangers offline
- Transforming online acquaintance into real-world interaction
- Encouraging cross-major and cross-background communication
- Enabling potential long-term friendships and collaborations

---

## 4. Target Users

- Undergraduate students
- Graduate students
- First-year students without stable social circles
- Students seeking broader social connections

---

## 5. Problem Statements (Hypotheses)

### Hypothesis 1
Students often experience situations where they want someone to eat or talk with.

### Hypothesis 2
Existing campus social mechanisms are insufficient for meeting new people.

Examples:
- Interaction stops after exchanging contact information
- Limited opportunities for structured stranger encounters
- Social circles tend to remain fixed

### Hypothesis 3
Students may accept a campus-authenticated meal-matching system if safety, awkwardness reduction, and compatibility are addressed.

---

## 6. Research Objectives (Questionnaire Goals)

The questionnaire aims to understand:

1. Whether the problem truly exists
2. How students currently handle it
3. Willingness to use a structured matching system
4. Expected features and concerns

The questionnaire should follow:

Experience → Pain Points → Current Behavior → Attitudes → Expectations

---

## 7. System-Level Technology Strategy (High-Level Only)

Ueat is designed as a multi-stage, cross-platform system.

### 1. Prototype Phase
- Web-based prototype for early validation
- Used for UI/UX testing and requirement verification

### 2. Primary Deployment Phase
- WeChat Mini Program
- Designed for low entry barrier and high accessibility among university students
- Compatible with campus usage scenarios

### 3. Extended Platform (Optional)
- HarmonyOS application
- For broader ecosystem integration and multi-device support

### 4. Backend System (Conceptual Stage)
- API-driven architecture (high-level design)
- Supports user management, matching logic, and safety mechanisms

### 5. Data Scope (Conceptual)
- User profiles
- Matching preferences
- Interaction history (invitations, feedback, records)

Note: The final implementation stack will be defined during the system design phase.

---

## 8. Functional Scope (Conceptual)

### User Management
- Campus authentication
- Personal profile
- Interest tags
- Academic information
- Preferences (time, location)

### Matching System
- Interest-based matching
- Major-based matching
- Grade-based matching
- Time-based matching
- Random matching
- Theme-based matching

### Interaction Support
- Meal invitation system
- Scheduling and rescheduling
- History tracking
- Feedback after meetings

### Ice-breaking Support
- Conversation starters
- Topic prompts
- Structured self-introduction

### Safety System
- Identity verification
- Reporting and blocking
- Privacy protection
- Controlled contact exposure

---

## 9. Design Philosophy

Ueat does NOT aim to force deep relationships.

Instead, it focuses on ensuring a successful **first offline interaction**.

Any further relationship development is left to users.

---

## 10. Documentation Structure

### 00_Project_Context.md
- Entry point of the project
- High-level system overview
- Always read first

### 01_Pre-Full_Conversation_summary.md
- Early ideation and reasoning
- Problem discovery background

### 02_Questionnaire.md
- User research instrument
- Hypothesis validation tool

### 04_Archive.md
- Raw conversation history
- Used only for deep reference

---

## 11. Planned Deliverables

- User research questionnaire
- Requirement analysis document
- Vision document
- Use case diagrams
- UI prototype
- Iteration plan
- WeChat Mini Program implementation
- (Optional) HarmonyOS extension

---

## 12. AI Development Workflow
This project uses a standardized AI-assisted development workflow.

All AI tools (Codex / ChatGPT / others) must follow:

- docs/03_AI_Workflow_Prompt_Template.md

Core principles:
- /docs is the single source of truth
- Prompts must follow "Base Prompt + Task" structure
- Code and documentation must stay synchronized
- No feature should be added without documentation or research support---

## 13. Expected AI Support Role & AI Development Workflow

AI assistance is expected to:

- Refine questionnaire design
- Analyze user research results
- Discover hidden user needs
- Support use case design
- Improve UX and interaction flow
- Assist in system documentation
- Support implementation and coding

All feature suggestions must be justified by user pain points or research findings.
Future AI assistance should follow the standardized AI development workflow defined in this document and detailed in docs/03_AI_Workflow_Prompt_Template.md.