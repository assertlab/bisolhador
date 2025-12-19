# 3. Client-Side GitHub API Integration

Date: 2024-01-01 (Retroactive)

## Status

Accepted

## Context

The application needs to fetch extensive data from GitHub API. Centralizing these requests in a backend server would quickly exhaust the server's API Rate Limit, requiring complex OAuth implementation or IP rotation.

## Decision

We decided to consume the GitHub API directly from the **Client-Side (Browser)**.

## Consequences

* **Positive:** Distributed Rate Limiting (each user uses their own IP quota); reduced backend costs and logic.
* **Negative:** Logic is exposed in the browser; handling large datasets depends on the user's device performance.
