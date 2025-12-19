# 1. Adoption of Supabase as Backend-as-a-Service

Date: 2024-01-01 (Retroactive)

## Status

Accepted

## Context

The project required a persistence layer for search history, simple authentication mechanisms, and the ability to execute remote logic (RPCs) without the overhead of maintaining a dedicated backend server (Node.js/Python/Go) and infrastructure.

## Decision

We decided to use **Supabase** as the backend infrastructure.

## Consequences

* **Positive:** Rapid development cycle; managed PostgreSQL database; built-in security (RLS); easy RPC creation for server-side logic.
* **Negative:** Vendor lock-in risk (mitigated by the underlying open-source PostgreSQL).
