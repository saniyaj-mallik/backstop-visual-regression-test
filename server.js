// File: server.js

import express from 'express'
import path, { dirname } from 'path'
import fs from 'fs-extra'
import bodyParser from 'body-parser'
import { fileURLToPath } from 'url'
import {
  createRunDir,
  generateBackstopConfig,
  writeConfig,
  runBackstop,
  parseResult
} from './src/backstop-helper.js'
import cors from 'cors'


const __dirname = dirname(fileURLToPath(import.meta.url))

process.env.BACKSTOPJS_NO_OPEN = 'true'

const app = express()
const PORT = process.env.PORT || 3000

app.use(bodyParser.json({ limit: '1mb' }))
app.use(cors({
  origin: "*",
  exposedHeaders: ['X-Total-Count'],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Total-Count"],
}));

// Serve static BackstopJS HTML reports
app.use('/backstop_data', express.static(path.join(__dirname, 'backstop_data')))

// POST /api/run-backstop
app.post('/api/compare', async (req, res) => {
  let { refUrl, testUrl, viewport } = req.body
  // Set default viewport if missing or incomplete
  const defaultViewport = { width: 1280, height: 800 }
  viewport = {
    width: (viewport && viewport.width) || defaultViewport.width,
    height: (viewport && viewport.height) || defaultViewport.height
  }
  if (!refUrl || !testUrl) {
    return res.status(400).json({ error: 'Missing required fields: refUrl, testUrl' })
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

// GET /api/tests/all (limit to 20 most recent)
app.get('/api/tests/all', async (req, res) => {
  const dataDir = path.join(__dirname, 'backstop_data')
  let results = []
  try {
    let runDirs = await fs.readdir(dataDir)
    // Sort by folder creation time descending (most recent first)
    runDirs = await Promise.all(runDirs.map(async dir => {
      const runPath = path.join(dataDir, dir)
      const stat = await fs.stat(runPath).catch(() => null)
      return stat && stat.isDirectory() ? { dir, ctime: stat.ctimeMs } : null
    }))
    runDirs = runDirs.filter(Boolean).sort((a, b) => b.ctime - a.ctime).slice(0, 20)
    for (const { dir } of runDirs) {
      const runPath = path.join(dataDir, dir)
      try {
        const result = parseResult(runPath)
        results.push(result)
      } catch (e) {
        // Ignore runs without valid results
      }
    }
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list test results' })
  }
})

app.listen(PORT, () => {
  console.log(`Backstop Visual Regression API running on port ${PORT}`)
})
