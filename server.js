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
// Import API routes
import apiRouter from './routes/api.js'


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

// Mount API router
app.use('/api', apiRouter)

app.listen(PORT, () => {
  console.log(`Backstop Visual Regression API running on port ${PORT}`)
})
