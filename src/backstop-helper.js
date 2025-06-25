const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const backstop = require('backstopjs')

// Generate a unique run directory
function createRunDir() {
  const runId = uuidv4()
  const runDir = path.join(__dirname, '..', 'backstop_data', runId)
  fs.ensureDirSync(runDir)
  return { runId, runDir }
}

// Generate backstop config for a run
function generateBackstopConfig({ refUrl, testUrl, viewport, runDir }) {
  const scenarioLabel = `Visual Regression Test - ${new Date().toISOString()}`
  return {
    id: `backstop_${Date.now()}`,
    viewports: [
      {
        label: 'custom',
        width: viewport.width,
        height: viewport.height
      }
    ],
    scenarios: [
      {
        label: scenarioLabel,
        url: testUrl,
        referenceUrl: refUrl,
        hideSelectors: [],
        removeSelectors: [],
        selectors: ['document'],
        readyEvent: '',
        delay: 0,
        misMatchThreshold: 0.1,
        requireSameDimensions: true
      }
    ],
    paths: {
      bitmaps_reference: path.join(runDir, 'bitmaps_reference'),
      bitmaps_test: path.join(runDir, 'bitmaps_test'),
      engine_scripts: path.join(runDir, 'engine_scripts'),
      html_report: path.join(runDir, 'html_report'),
      ci_report: path.join(runDir, 'ci_report')
    },
    report: ['browser'],
    engine: 'puppeteer',
    engineOptions: {},
    asyncCaptureLimit: 5,
    asyncCompareLimit: 50,
    debug: false,
    debugWindow: false,
    openReport: false
  }
}

// Write config to file
function writeConfig(config, runDir) {
  const configPath = path.join(runDir, 'backstop.json')
  fs.writeJsonSync(configPath, config, { spaces: 2 })
  return configPath
}

// Run backstop reference and test
async function runBackstop(configPath, runDir) {
  try {
    await backstop('reference', { config: configPath })
    try {
      await backstop('test', { config: configPath })
    } catch (err) {
      // Ignore mismatch errors, always parse result
    }
  } catch (err) {
    throw err
  }
}

// Parse the backstop test result
function parseResult(runDir) {
  let reportPath = path.join(runDir, 'ci_report', 'backstop_test_results.json')
  if (!fs.existsSync(reportPath)) {
    // Try bitmaps_test/*/report.json
    const bitmapsTestDir = path.join(runDir, 'bitmaps_test')
    if (fs.existsSync(bitmapsTestDir)) {
      const subdirs = fs.readdirSync(bitmapsTestDir).filter(f => fs.statSync(path.join(bitmapsTestDir, f)).isDirectory())
      for (const sub of subdirs) {
        const altReport = path.join(bitmapsTestDir, sub, 'report.json')
        if (fs.existsSync(altReport)) {
          reportPath = altReport
          break
        }
      }
    }
    if (!fs.existsSync(reportPath)) {
      throw new Error('Backstop report not found')
    }
  }
  const report = fs.readJsonSync(reportPath)
  let mismatchPercentage = null
  let passed = true
  if (Array.isArray(report.tests)) {
    const testPair = report.tests[0] && report.tests[0].pair
    mismatchPercentage = testPair ? testPair.misMatchPercentage : null
    passed = report.tests.every(t => t.status === 'pass')
  } else if (Array.isArray(report)) {
    // Newer BackstopJS: array of test results
    const testPair = report[0] && report[0].pair
    mismatchPercentage = testPair ? testPair.misMatchPercentage : null
    passed = report.every(t => t.status === 'pass')
  }
  return {
    passed,
    mismatchPercentage,
    reportUrl: `/backstop_data/${path.basename(runDir)}/html_report/index.html`
  }
}

module.exports = {
  createRunDir,
  generateBackstopConfig,
  writeConfig,
  runBackstop,
  parseResult
} 