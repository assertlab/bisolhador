# 4. Data Sanitization Strategy for Persistence

Date: 2025-09-01 (Retroactive)

## Status

Accepted

## Context

Attempting to save raw data from massive repositories (e.g., Linux Kernel) caused JSON parsing errors and payload size issues in Supabase/Postgres, often due to circular references or unstable API responses.

## Decision

We implemented a **Sanitization Layer (`sanitizeForJson`)** that filters the dataset before persistence, removing circular references and non-essential fields.

## Consequences

* **Positive:** System stability; guarantee that snapshots can be saved and retrieved without corruption; reduced database storage size.
* **Negative:** Slight data loss (some raw details are discarded), requiring updates to the sanitizer if new fields are needed for future reports.
