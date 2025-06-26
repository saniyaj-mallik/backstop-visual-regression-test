## [Unreleased]
- Initial implementation: Node.js + Express API for BackstopJS visual regression testing
- POST /api/run-backstop endpoint
- Dynamic per-run config and output
- HTML report serving
- Error and timeout handling
- Refactor: Moved API logic to `controllers/apiController.js` and route definitions to `routes/api.js` for better project structure and maintainability. Updated `server.js` to use the new router. Updated `README.md` to document the new structure.
- Feature: Added POST /api/test/sitemap endpoint to fetch and parse two XML sitemaps, returning arrays of URLs for each. Implemented in controller and route, and documented in README.
- Change: The POST /api/test/sitemap endpoint response now includes testDomain and refDomain for reconstructing full URLs. Updated documentation accordingly.
- Feature: The POST /api/test/sitemap endpoint now runs a visual regression test for each matching path and includes a testresults array in the response. Updated documentation accordingly. 