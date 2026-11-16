// Puts hammerkit's single-file release binary on PATH, kept in the runner's tool cache.
// Plain Node APIs only: the action runs on the runner's own node24, so no install step
// and no setup-node are needed.
const { execFileSync, execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')

const RELEASES = 'https://github.com/no0dles/hammerkit/releases/download'
const REGISTRY = 'https://registry.npmjs.org/hammerkit'
const ATTEMPTS = 3

class NotFound extends Error {}

function fail(message) {
  console.log(`::error::${message}`)
  process.exit(1)
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}${os.EOL}`)
  }
}

function addPath(dir) {
  if (process.env.GITHUB_PATH) {
    fs.appendFileSync(process.env.GITHUB_PATH, `${dir}${os.EOL}`)
  }
}

// fetch follows redirects (github.com sends release assets to its object storage);
// a 404 means there is nothing to retry, anything else gets another attempt
async function get(url) {
  let lastError
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'hammerkit-github-action' } })
      if (res.status === 404) throw new NotFound(`${url} returned 404`)
      if (!res.ok) throw new Error(`${url} returned ${res.status} ${res.statusText}`)
      return res
    } catch (e) {
      if (e instanceof NotFound) throw e
      lastError = e
      if (attempt < ATTEMPTS) {
        console.log(`${e.message}, attempt ${attempt} of ${ATTEMPTS}; retrying`)
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      }
    }
  }
  throw lastError
}

// an exact version needs no lookup, so a cached one is found without the network;
// a dist-tag (latest, next) is resolved with the npm registry
async function resolveVersion(input) {
  const exact = input.replace(/^v(?=\d)/, '')
  if (/^\d+\.\d+\.\d+([-+][0-9A-Za-z.+-]*)?$/.test(exact)) return exact
  let res
  try {
    res = await get(`${REGISTRY}/${encodeURIComponent(input)}`)
  } catch (e) {
    if (e instanceof NotFound) fail(`npm knows no hammerkit version or dist-tag "${input}"`)
    fail(`resolving hammerkit@${input} with the npm registry failed: ${e.message}`)
  }
  const { version } = await res.json()
  if (typeof version !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(version)) {
    fail(`the npm registry returned no version for hammerkit@${input}`)
  }
  return version
}

function assetName() {
  const platform = { linux: 'linux', darwin: 'macos', win32: 'win' }[process.platform]
  const arch = { x64: 'x64', arm64: 'arm64' }[process.arch]
  if (!platform || !arch) return null
  return `hammerkit-${platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`
}

// the layout of @actions/tool-cache: <tool cache>/<tool>/<version>/<arch>, finished by a
// <arch>.complete marker next to it, so a half-written download is never taken for a hit
async function installBinary(version, asset) {
  const toolCache = process.env.RUNNER_TOOL_CACHE || path.join(os.tmpdir(), 'hammerkit-tool-cache')
  const dir = path.join(toolCache, 'hammerkit', version, process.arch)
  const marker = `${dir}.complete`
  const binary = path.join(dir, process.platform === 'win32' ? 'hammerkit.exe' : 'hammerkit')

  if (fs.existsSync(marker) && fs.existsSync(binary)) {
    console.log(`hammerkit ${version} found in the tool cache: ${dir}`)
    return { dir, binary, cacheHit: true }
  }

  const url = `${RELEASES}/v${version}/${asset}`
  console.log(`Downloading ${url}`)
  const started = Date.now()
  const res = await get(url)
  fs.rmSync(marker, { force: true })
  fs.mkdirSync(dir, { recursive: true })
  const partial = `${binary}.${process.pid}.download`
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial))
    fs.chmodSync(partial, 0o755)
    fs.renameSync(partial, binary)
  } catch (e) {
    fs.rmSync(partial, { force: true })
    throw e
  }
  fs.writeFileSync(marker, '')
  const size = (fs.statSync(binary).size / 1e6).toFixed(0)
  console.log(`Downloaded ${size} MB in ${((Date.now() - started) / 1000).toFixed(1)} s to ${dir}`)
  return { dir, binary, cacheHit: false }
}

// releases before the single-file binaries (and platforms without one) come from npm,
// which needs Node.js and npm on PATH
function installWithNpm(version, reason) {
  console.log(`::notice::${reason}; installing hammerkit@${version} with npm instead`)
  try {
    // a shell is needed on Windows, where npm is npm.cmd
    execSync(`npm install --global hammerkit@${version}`, { stdio: 'inherit' })
    execSync('hammerkit --version', { stdio: 'inherit' })
  } catch (e) {
    fail(`installing hammerkit@${version} with npm failed: ${e.message}`)
  }
}

async function main() {
  // inputs reach a JavaScript action as INPUT_<NAME> environment variables
  const input = (process.env.INPUT_VERSION || 'latest').trim()

  // a version or dist-tag only — the value ends up in a URL and, as a fallback, a shell command
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(input)) fail(`invalid hammerkit version "${input}"`)

  const version = await resolveVersion(input)
  if (version !== input) console.log(`hammerkit@${input} is ${version}`)
  setOutput('version', version)

  const asset = assetName()
  if (!asset) {
    setOutput('cache-hit', 'false')
    return installWithNpm(version, `hammerkit has no binary for ${process.platform} ${process.arch}`)
  }

  let installed
  try {
    installed = await installBinary(version, asset)
  } catch (e) {
    if (e instanceof NotFound) {
      setOutput('cache-hit', 'false')
      return installWithNpm(version, `release v${version} has no ${asset}`)
    }
    fail(`downloading hammerkit ${version} (${asset}) failed: ${e.message}`)
  }

  setOutput('cache-hit', String(installed.cacheHit))
  addPath(installed.dir)
  try {
    execFileSync(installed.binary, ['--version'], { stdio: 'inherit' })
  } catch (e) {
    fail(`${installed.binary} --version failed: ${e.message}`)
  }
}

main().catch((e) => fail(e.message))
