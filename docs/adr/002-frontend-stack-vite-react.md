# 2. Frontend Stack: Vite and React

Date: 2024-01-01 (Retroactive)

## Status

Accepted

## Context

We needed a Single Page Application (SPA) capable of rendering complex charts and handling client-side data processing efficiently. The developer experience (DX) regarding build times and hot reloading was a priority.

## Decision

We chose **Vite** as the build tool and **React** as the UI library.

## Consequences

* **Positive:** Extremely fast build and HMR times; rich ecosystem of charting libraries (Recharts/Chart.js); component-based architecture suitable for the dashboard.
* **Negative:** Requires client-side rendering optimizations for large datasets.
