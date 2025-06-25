# BackstopJS Visual Regression Testing Tool

A Node.js + Express API service that wraps BackstopJS to perform visual regression testing between two URLs.

## Features
- POST `/api/run-backstop` to run a visual regression test between a reference and test URL
- Dynamically generates a unique BackstopJS config and output directory per run
- Serves BackstopJS HTML reports at `/backstop_data/<runId>/html_report`
- Handles timeouts and unreachable URLs gracefully

## Setup

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

or

```bash
node server.js
```

### API: POST `/api/run-backstop`

**Request Body:**
```json
{
  "refUrl": "https://saniyajmallik.vercel.app/",
  "testUrl": "https://majorprojecthub.vercel.app/",
  "viewport": {
    "width": 1280,
    "height": 800
  }
}
```

**Response:**
```json
{
  "passed": false,
  "reportUrl": "/backstop_data/692345b7-7ae3-449a-b926-c3c92e3305d8/html_report/index.html"
}
```

- The `reportUrl` can be opened in a browser to view the visual diff report.

## Notes
- Each test run is stored in a unique directory under `backstop_data/`.
- Reports are accessible as long as the server is running and files are not deleted.
- Errors and timeouts are handled with clear error messages.

## Dependencies
- express
- backstopjs
- fs-extra
- uuid
- path

---

MIT License