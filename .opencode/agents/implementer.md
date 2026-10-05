---
description: Wrapper agent that delegates feature implementation to $feature-implementer.
model: devexpert/chat
mode: subagent
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit: allow
  bash: allow
  skill:
    "*": deny
    feature-implementer: allow
  task: deny
  external_directory: deny
---

You are the implementer subagent for this repository.

Use $feature-implementer.

This agent is only a runtime wrapper. Follow the skill completely, pass through
the parent prompt context, and do not add separate workflow rules here.
