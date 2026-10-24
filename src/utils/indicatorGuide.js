// "Como interpretar": one entry per indicator, shown on /guia and linked from
// each card (#id). Texts live in locales (guide.items.<id>.{name, what, read,
// limits, chaossNote}); this file holds the structure and the CHAOSS mapping.
//
// CHAOSS (Community Health Analytics in Open Source Software, Linux
// Foundation) defines community-health metrics. Each reference was checked
// against its definition page (2026-10): `relation` says how close ours is —
// 'equivalent' (same question and method), 'related' (same question, different
// method — the difference is in chaossNote), 'none' (no CHAOSS metric).
const kb = (slug) => `https://www.chaoss.community/kb/${slug}/`;

export const CHAOSS = {
  changeRequestsDuration: { name: 'Change Requests Duration', url: kb('metric-change-requests-duration') },
  changeRequestReviews: { name: 'Change Request Reviews', url: kb('metric-change-request-reviews') },
  changeRequestReviewDuration: { name: 'Change Request Review Duration', url: kb('metric-change-request-review-duration') },
  timeToFirstResponse: { name: 'Time to First Response', url: kb('metric-time-to-first-response') },
  selfMergeRates: { name: 'Self-Merge Rates', url: kb('metric-self-merge-rates') },
  codeChangesLines: { name: 'Code Changes Lines', url: kb('metric-code-changes-lines') },
  codeChangesCommits: { name: 'Code Changes Commits', url: kb('metric-code-changes-commits') },
  contributorAbsenceFactor: { name: 'Contributor Absence Factor', url: kb('metric-contributor-absence-factor') },
  contributors: { name: 'Contributors', url: kb('metric-contributors') },
  activityDatesAndTimes: { name: 'Activity Dates and Times', url: kb('metric-activity-dates-and-times') },
  issuesClosed: { name: 'Issues Closed', url: kb('metric-issues-closed') },
  releaseFrequency: { name: 'Release Frequency', url: kb('metric-release-frequency') },
  licensesDeclared: { name: 'Licenses Declared', url: kb('metric-licenses-declared') },
  codeOfConduct: { name: 'Code of Conduct for a Project', url: kb('metric-code-of-conduct-for-a-project') },
  documentationDiscoverability: { name: 'Documentation Discoverability', url: kb('metric-documentation-discoverability') },
  testCoverage: { name: 'Test Coverage', url: kb('metric-test-coverage') },
  branchLifecycle: { name: 'Branch Lifecycle', url: kb('metric-branch-lifecycle') },
  projectPopularity: { name: 'Project Popularity', url: kb('metric-project-popularity') },
  languageDistribution: { name: 'Programming Language Distribution', url: kb('metric-programming-language-distribution') },
  changeRequests: { name: 'Change Requests', url: kb('metric-change-requests') },
  changeRequestsAccepted: { name: 'Change Requests Accepted', url: kb('metric-change-requests-accepted') },
};

// Linked as "CHAOSS Data Ethics document" from every CHAOSS metric page
export const DATA_ETHICS_URL = 'https://github.com/chaoss/community/blob/main/data-use-statement.md';

/** Sections in display order; each item: id (anchor), chaoss refs, relation. */
export const GUIDE_SECTIONS = [
  {
    id: 'popularity',
    items: [
      { id: 'stars-forks', chaoss: ['projectPopularity'], relation: 'related' },
      { id: 'languages', chaoss: ['languageDistribution'], relation: 'related' },
      { id: 'issues', chaoss: ['issuesClosed'], relation: 'related' },
      { id: 'prs-merges', chaoss: ['changeRequests', 'changeRequestsAccepted'], relation: 'related' },
    ],
  },
  {
    id: 'review',
    items: [
      { id: 'lead-time', chaoss: ['changeRequestsDuration'], relation: 'equivalent' },
      { id: 'review-coverage', chaoss: ['changeRequestReviews', 'selfMergeRates'], relation: 'related' },
      { id: 'first-review', chaoss: ['changeRequestReviewDuration', 'timeToFirstResponse'], relation: 'related' },
      { id: 'pr-size', chaoss: ['codeChangesLines'], relation: 'related' },
      { id: 'divergence', chaoss: ['changeRequestReviews'], relation: 'none' },
    ],
  },
  {
    id: 'practices',
    items: [
      { id: 'ci-health', chaoss: [], relation: 'none' },
      { id: 'conventional-commits', chaoss: ['codeChangesCommits'], relation: 'none' },
      { id: 'release-cadence', chaoss: ['releaseFrequency'], relation: 'related' },
    ],
  },
  {
    id: 'governance',
    items: [
      { id: 'health-score', chaoss: ['licensesDeclared', 'codeOfConduct', 'documentationDiscoverability'], relation: 'related' },
      { id: 'maturity', chaoss: ['testCoverage'], relation: 'related' },
      { id: 'zombie-branches', chaoss: ['branchLifecycle'], relation: 'related' },
    ],
  },
  {
    id: 'classroom',
    items: [
      { id: 'classroom', chaoss: [], relation: 'none' },
    ],
  },
  {
    id: 'people',
    items: [
      { id: 'bus-factor', chaoss: ['contributorAbsenceFactor'], relation: 'related' },
      { id: 'contributors', chaoss: ['contributors'], relation: 'related' },
      { id: 'commit-activity', chaoss: ['codeChangesCommits'], relation: 'related' },
      { id: 'weekdays', chaoss: ['activityDatesAndTimes'], relation: 'related' },
      { id: 'add-delete', chaoss: ['codeChangesLines'], relation: 'related' },
    ],
  },
];

export const GUIDE_IDS = GUIDE_SECTIONS.flatMap((s) => s.items.map((i) => i.id));

/** Path to an indicator's entry ("Como interpretar" links on cards). */
export const guidePath = (id) => `/guia#${id}`;
