# Roadmap - Bisolhador Dashboard

## Implementation Plan

### Overview
Dashboard SPA for analyzing GitHub repository metrics focused on supporting Software Engineering education.

**Stack**: HTML5, JavaScript ES6 Modules, Tailwind CSS (CDN), Chart.js, GitHub REST API

---

## Phase 1: Scaffolding

#### 1.1 Directory Structure
- [ ] Create project folder structure:
  - [ ] `/src` - Source code
  - [ ] `/src/modules` - ES6 JavaScript modules
  - [ ] `/src/styles` - Custom styles (if needed)
  - [ ] `/src/utils` - Utilities and helpers
  - [ ] `/assets` - Static resources (icons, images)
  - [ ] `/docs` - Additional documentation

#### 1.2 Base HTML File
- [ ] Create `index.html` in project root
- [ ] Configure semantic HTML5 structure
- [ ] Add meta tags (viewport, charset, description)
- [ ] Include Tailwind CSS via CDN
- [ ] Include Chart.js via CDN
- [ ] Configure `<script type="module">` for entry point
- [ ] Add basic layout structure (header, main, footer)

#### 1.3 Initial Configuration
- [ ] Create `.gitignore` (if not exists)
- [ ] Create `package.json` for dependency documentation (optional)
- [ ] Configure constants file (`src/config.js`):
  - [ ] GitHub API base URL
  - [ ] Default rate limits
  - [ ] Timeout configurations

---

## Phase 2: Core Logic

#### 2.1 GitHub API Module (`src/modules/githubAPI.js`)
- [ ] Create `GitHubAPI` class/object for API call encapsulation
- [ ] Implement `fetchRepository(owner, repo)` method:
  - [ ] Validate input parameters
  - [ ] Construct API URL
  - [ ] Perform fetch with error handling
  - [ ] Return structured data
- [ ] Implement `fetchCommits(owner, repo, params)` method:
  - [ ] Support pagination
  - [ ] Filter by period (optional)
  - [ ] Handle empty responses
- [ ] Implement `fetchPullRequests(owner, repo, state)` method:
  - [ ] Support states: open, closed, all
  - [ ] Return count and details
- [ ] Implement `fetchIssues(owner, repo, state)` method:
  - [ ] Support states: open, closed, all
  - [ ] Return count and details

#### 2.2 Error Handling (`src/utils/errorHandler.js`)
- [ ] Create `handleAPIError(error, response)` function:
  - [ ] Detect 404 error (repository not found)
  - [ ] Detect 403 error (Rate Limit exceeded)
  - [ ] Detect 401 error (authentication required)
  - [ ] Return user-friendly messages
- [ ] Create `displayError(message)` for UI
- [ ] Implement retry logic for Rate Limit (with exponential backoff)
- [ ] Add logging for debug (console.warn/error)

#### 2.3 Data Processing (`src/utils/dataProcessor.js`)
- [ ] Create `aggregateCommitsByDay(commits)` function:
  - [ ] Group commits by date
  - [ ] Count commits per day
  - [ ] Return structure for Chart.js
- [ ] Create `calculateMetrics(repoData)` function:
  - [ ] Total commits
  - [ ] Total PRs (open/closed)
  - [ ] Total Issues (open/closed)
  - [ ] Unique contributors
- [ ] Create `formatDate(dateString)` for display
- [ ] Create `sanitizeInput(input)` for security

---

## Phase 3: UI/UX

#### 3.1 Search Component (`src/modules/searchComponent.js`)
- [ ] Create HTML search form:
  - [ ] Input for owner (user/organization)
  - [ ] Input for repository name
  - [ ] Search button
  - [ ] Loader/spinner during search
- [ ] Implement input validation:
  - [ ] Required fields
  - [ ] Valid format (no special characters)
  - [ ] Visual error feedback
- [ ] Implement submit event:
  - [ ] Prevent page reload
  - [ ] Show loading state
  - [ ] Call API module
  - [ ] Update dashboard with results
- [ ] Add search history (localStorage - optional)

#### 3.2 Metrics Cards (`src/modules/metricsCards.js`)
- [ ] Create HTML template for cards:
  - [ ] Commits card (total, icon)
  - [ ] Pull Requests card (open/closed)
  - [ ] Issues card (open/closed)
  - [ ] Contributors card (optional)
- [ ] Apply Tailwind styling:
  - [ ] Responsive grid/flex
  - [ ] Semantic colors and icons
  - [ ] Hover effects
  - [ ] Animation transitions (optional)
- [ ] Implement `renderMetricsCards(metrics)` function:
  - [ ] Clear previous container
  - [ ] Inject new data
  - [ ] Apply number formatting
- [ ] Add loading state for cards

#### 3.3 Chart Visualization (`src/modules/chartComponent.js`)
- [ ] Create Chart.js container HTML
- [ ] Implement `renderCommitsChart(commitData)` function:
  - [ ] Configure bar chart
  - [ ] X-axis: days
  - [ ] Y-axis: commit count
  - [ ] Colors and labels
  - [ ] Responsiveness
- [ ] Add Chart.js options:
  - [ ] Custom tooltip
  - [ ] Legend
  - [ ] Animations
- [ ] Implement `destroyChart()` for cleanup
- [ ] Add empty state (no data to display)

#### 3.4 Layout and Responsiveness
- [ ] Structure main layout with Tailwind:
  - [ ] Header with title and description
  - [ ] Centered search section
  - [ ] Metrics cards grid
  - [ ] Full-width chart section
  - [ ] Footer with credits/links
- [ ] Implement responsiveness:
  - [ ] Mobile-first approach
  - [ ] Breakpoints: sm, md, lg, xl
  - [ ] Adaptive grid (1 col → 2 cols → 4 cols)
  - [ ] Responsive chart
- [ ] Add dark mode (optional):
  - [ ] Toggle switch
  - [ ] Tailwind dark classes:
  - [ ] Persist preference (localStorage)

#### 3.5 Application State (`src/modules/appState.js`)
- [ ] Create simple state manager:
  - [ ] Loading state
  - [ ] Error state
  - [ ] Success state with data
  - [ ] Initial empty state
- [ ] Implement `setState(newState)` function:
  - [ ] Update UI based on state
  - [ ] Show/hide components
  - [ ] Apply conditional CSS classes
- [ ] Add visual feedback for each state:
  - [ ] Skeleton loaders
  - [ ] Friendly error messages
  - [ ] Illustrated empty state

---

## Phase 4: Integration and Polish

#### 4.1 Entry Point (`src/main.js`)
- [ ] Import all necessary modules
- [ ] Initialize app on DOMContentLoaded
- [ ] Configure global event listeners
- [ ] Implement main flow:
  - [ ] User submits search
  - [ ] Fetch data from API
  - [ ] Process data
  - [ ] Render UI
  - [ ] Handle errors
- [ ] Add cleanup on errors

#### 4.2 Manual Testing
- [ ] Test search with valid repository
- [ ] Test search with non-existent repository (404)
- [ ] Test behavior with Rate Limit exceeded
- [ ] Test responsiveness across viewports
- [ ] Test with repositories of different sizes
- [ ] Test edge cases:
  - [ ] Repository with no commits
  - [ ] Repository with no PRs/Issues
  - [ ] Private repository (403)

#### 4.3 Optimizations
- [ ] Implement search debounce (optional)
- [ ] Recent request caching (optional)
- [ ] Lazy Chart.js loading (optional)
- [ ] Code minification for production (optional)

#### 4.4 Documentation
- [ ] Update README.md with:
  - [ ] Project description
  - [ ] How to run locally
  - [ ] Screenshots/GIFs
  - [ ] Used technologies
  - [ ] Known limitations
- [ ] Add JSDoc comments to main modules
- [ ] Create CONTRIBUTING.md (optional)

---

## Technical Notes

### GitHub API Rate Limits
- **Without authentication**: 60 requests/hour
- **With token**: 5000 requests/hour
- **Recommendation**: Implement token authentication for testing

### Main Endpoints
```
GET /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/commits
GET /repos/{owner}/{repo}/pulls
GET /repos/{owner}/{repo}/issues
```

### Security Considerations
- Sanitize user inputs
- Do not expose API tokens in code (use environment variables)
- Validate API responses before processing
- Implement CSP headers (if using server)

---

## Completion Criteria

- ✅ Dashboard loads without errors
- ✅ Repository search works
- ✅ Metrics display correctly
- ✅ Weekly commits chart renders
- ✅ Errors handled and displayed to user
- ✅ Interface is responsive (mobile/desktop)
- ✅ README.md is updated

---

**Next Steps**: After plan approval, start implementation from Phase 1.
