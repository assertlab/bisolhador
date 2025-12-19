# 6. Global Timezone Support

Date: 2025-12-19

## Status

Accepted

## Context

Initially, the date filtering logic was hardcoded to 'America/Recife'. As the user base expands globally, this caused discrepancies where reports generated in one timezone would not appear correctly in filters for users in other timezones.

## Decision

We implemented dynamic timezone detection using `Intl.DateTimeFormat` on the frontend and updated the SQL RPCs to accept a `p_timezone` parameter.

## Consequences

* **Positive:** Accurate reporting regardless of user location; removed hardcoded regional dependencies.
* **Negative:** Slightly more complex SQL queries involving timezone conversion.
