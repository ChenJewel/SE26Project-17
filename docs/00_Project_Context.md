# Project Context – Campus Meal Companion (Software Engineering Course)

## Project Overview

This is a software engineering course project. The product is a campus social platform (initially planned as a web application, later to be implemented as a WeChat Mini Program and potentially a HarmonyOS application).

The core idea is **not** to build a dating app or a general social network. Instead, the goal is to lower the barrier for university students to meet new people through a natural daily activity—sharing a meal.

The working name of the project is **Campus Meal Companion** (or **Campus Meal Buddy**).

---

# Project Motivation

The idea originated from a popular post on Shanghai Jiao Tong University's Shuiyuan Community.

In the post, a student invited a different stranger to have dinner every evening, hoping to talk with people from different majors, backgrounds, personalities, and life experiences.

The discussion revealed several recurring themes:

* Many students experience loneliness during university.
* Students often add each other on WeChat but never interact again.
* Existing campus social opportunities mainly rely on classes, clubs, or dormitories.
* Students wish to meet new people but lack low-pressure opportunities.
* Many believe meaningful conversations are valuable.
* Others worry that one dinner is insufficient to build deep relationships.
* Students also worry about awkwardness, safety, and maintaining connections after the first meeting.

These discussions serve as preliminary qualitative evidence, but they may suffer from selection bias because the participants are already interested in social interaction.

Therefore, a broader questionnaire is needed to validate whether these needs exist among the general student population.

---

# Product Vision

The project aims to provide university students with a trusted, low-pressure, and campus-oriented way to meet new people over meals.

The product is **not intended to solve loneliness itself**.

Instead, it aims to:

* Reduce the barrier to initiating offline social interaction.
* Help students transition from "knowing someone's WeChat" to actually meeting them.
* Encourage communication across majors, grades, and backgrounds.
* Create opportunities for future friendships and collaborations.

---

# Target Users

Primary users:

* Undergraduate students
* Graduate students
* New students who have not established social circles
* Students who wish to expand their social networks

---

# Problem Statements

The following hypotheses need to be validated through the questionnaire.

### Hypothesis 1

University students often experience situations where they want someone to eat or chat with.

---

### Hypothesis 2

Current campus social channels do not effectively support meeting new people.

Examples:

* Social interactions stop after exchanging contact information.
* Opportunities to meet strangers naturally are limited.
* Existing social circles are relatively fixed.

---

### Hypothesis 3

Students are willing to try a campus-authenticated meal-matching platform if concerns about awkwardness, safety, and compatibility are addressed.

---

# Questionnaire Objectives

The questionnaire should answer four major questions:

1. Do students actually experience this problem?

2. How are they currently solving it?

3. Would they accept a campus meal-matching platform?

4. What features and concerns should the platform address?

The questionnaire should avoid directly asking "Would you use this app?" at the beginning.

Instead, it should follow this order:

Experience
→ Pain Points
→ Current Behaviors
→ Attitudes
→ Product Expectations

---

# Potential Functional Requirements

(Current assumptions that should later be validated by survey results.)

## User

* Campus authentication
* Personal profile
* Interest tags
* Major
* Grade
* Preferred dining time
* Dining locations

---

## Matching

* Match by interests
* Match by major
* Match by grade
* Match by available time
* Random matching
* Theme-based matching

---

## Ice-breaking

Possible features include:

* AI-generated conversation starters
* Shared-interest prompts
* Topic cards
* Conversation themes
* Short self-introduction before meeting

---

## Meal Invitation

* Create invitation
* Accept invitation
* Cancel invitation
* Reschedule
* View upcoming meals

---

## Social

* Re-invite previous partners
* Add friends
* View meeting history
* Leave feedback after meals

---

## Safety

* Campus identity verification
* Report users
* Block users
* Privacy protection
* No public exposure of personal contact information

---

# Important Design Philosophy

The platform should **not** encourage "deep friendship" immediately.

Instead, it should focus on creating a successful first offline interaction.

The design goal is to lower the psychological barrier for strangers to meet.

A successful first meal may naturally lead to future friendships, but that should be the user's choice rather than the platform's promise.

---

# Planned Deliverables

The project will likely include:

* User research questionnaire
* Requirement analysis
* Vision Document
* Use Case Diagram
* Use Case Descriptions
* UI Prototype
* Iteration Plan
* WeChat Mini Program implementation
* (Optional) HarmonyOS implementation

---

# Expected Assistance

Future AI assistance should focus on:

* Refining questionnaire design
* Analyzing survey results
* Discovering hidden user needs
* Identifying new functional requirements
* Designing use cases
* Improving interaction flows
* Suggesting UI/UX improvements
* Writing software engineering documents
* Assisting implementation and coding

When proposing new features, always explain which user pain point or survey finding motivates the feature, rather than adding functionality without justification.
