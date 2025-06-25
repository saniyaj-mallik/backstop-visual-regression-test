// File: server.js

process.env.BACKSTOPJS_NO_OPEN = 'true'

const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const bodyParser = require('body-parser')
const {
  createRunDir,
  generateBackstopConfig,
  writeConfig,
  runBackstop,
  parseResult
} = require('./src/backstop-helper')

const app = express()
const PORT = process.env.PORT || 3000

app.use(bodyParser.json({ limit: '1mb' }))

// Serve static BackstopJS HTML reports
app.use('/backstop_data', express.static(path.join(__dirname, 'backstop_data')))

// POST /api/run-backstop
app.post('/api/run-backstop', async (req, res) => {
  const { refUrl, testUrl, viewport } = req.body
  if (!refUrl || !testUrl || !viewport || !viewport.width || !viewport.height) {
    return res.status(400).json({ error: 'Missing required fields: refUrl, testUrl, viewport {width, height}' })
  }
  let runDir, configPath
  try {
    const runInfo = createRunDir()
    runDir = runInfo.runDir
    const config = generateBackstopConfig({ refUrl, testUrl, viewport, runDir })
    configPath = writeConfig(config, runDir)
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('BackstopJS run timed out')), 5 * 60 * 1000))
    await Promise.race([
      runBackstop(configPath, runDir),
      timeoutPromise
    ])
    const result = parseResult(runDir)
    res.json(result)
  } catch (err) {
    if (runDir) {
      try {
        const result = parseResult(runDir)
        res.json(result)
        return
      } catch (parseErr) {
        res.status(500).json({ error: 'Backstop report not found. Possible causes: unreachable URL, timeout, or test crash.' })
        return
      }
    }
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Backstop Visual Regression API running on port ${PORT}`)
})
