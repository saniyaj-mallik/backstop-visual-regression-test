// File: routes/api.js

import express from 'express'
import { runBackstopCompare, getAllTests, getSitemapLinks } from '../controllers/apiController.js'

const router = express.Router()

// POST /api/compare
router.post('/compare', runBackstopCompare)

// GET /api/tests/all
router.get('/tests/all', getAllTests)

// POST /api/test/sitemap
router.post('/test/sitemap', getSitemapLinks)

export default router 