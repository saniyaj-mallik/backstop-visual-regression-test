// File: controllers/apiController.js

import path from 'path'
import fs from 'fs-extra'
import {
  createRunDir,
  generateBackstopConfig,
  writeConfig,
  runBackstop,
  parseResult
} from '../src/backstop-helper.js'
import { fileURLToPath } from 'url'
import { XMLParser } from 'fast-xml-parser'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Controller for POST /api/compare
export async function runBackstopCompare(req, res) {
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
}

// Controller for GET /api/tests/all
export async function getAllTests(req, res) {
  const dataDir = path.join(__dirname, '../backstop_data')
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
}

// Controller for POST /api/test/sitemap
export async function getSitemapLinks(req, res) {
  const { testsitemapurl, refsitemapurl } = req.body
  if (!testsitemapurl || !refsitemapurl) {
    return res.status(400).json({ error: 'Missing required fields: testsitemapurl, refsitemapurl' })
  }
  try {
    // Helper to fetch and parse sitemap
    async function fetchSitemapLinks(url) {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch sitemap: ${url}`)
      const xml = await response.text()
      const parser = new XMLParser({ ignoreAttributes: false })
      const parsed = parser.parse(xml)
      // Support both <urlset> and <sitemapindex>
      let urls = []
      if (parsed.urlset && parsed.urlset.url) {
        const urlNodes = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url]
        urls = urlNodes.map(u => u.loc).filter(Boolean)
      } else if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
        const sitemapNodes = Array.isArray(parsed.sitemapindex.sitemap) ? parsed.sitemapindex.sitemap : [parsed.sitemapindex.sitemap]
        urls = sitemapNodes.map(u => u.loc).filter(Boolean)
      }
      return urls
    }
    const [testLinks, refLinks] = await Promise.all([
      fetchSitemapLinks(testsitemapurl),
      fetchSitemapLinks(refsitemapurl)
    ])
    // Map URLs to their paths
    function getPath(url) {
      try {
        return new URL(url).pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
      } catch {
        return url // fallback if not a valid URL
      }
    }
    const testPaths = new Set(testLinks.map(getPath))
    const refPaths = new Set(refLinks.map(getPath))
    // Matching: paths in both
    const matchingUrls = [...testPaths].filter(p => refPaths.has(p))
    // Missing: in ref but not in test, and in test but not in ref
    const missingInTest = [...refPaths].filter(p => !testPaths.has(p))
    const missingInRef = [...testPaths].filter(p => !refPaths.has(p))
    // Extract domains from the first valid URL in each sitemap
    function getDomain(urls) {
      for (const url of urls) {
        try {
          const u = new URL(url)
          return u.origin
        } catch {}
      }
      return null
    }
    const testDomain = getDomain(testLinks)
    const refDomain = getDomain(refLinks)
    res.json({
      testDomain,
      refDomain,
      matchingUrls,
      missingUrls: {
        inTest: missingInTest,
        inRef: missingInRef
      },
      allRefUrls: refLinks,
      allTestUrls: testLinks
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch or parse sitemaps' })
  }
} 