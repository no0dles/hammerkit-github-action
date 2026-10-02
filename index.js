const { execSync } = require('child_process')

// inputs reach a JavaScript action as INPUT_<NAME> environment variables
const version = (process.env['INPUT_VERSION'] || 'latest').trim()

// a version or dist-tag only — the value ends up in a shell command
if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(version)) {
  console.log(`::error::invalid hammerkit version "${version}"`)
  process.exit(1)
}

try {
  // wait for the install, so hammerkit is on the PATH for the next step;
  // a shell is needed on Windows, where npm is npm.cmd
  execSync(`npm install --global hammerkit@${version}`, { stdio: 'inherit' })
  execSync('hammerkit --version', { stdio: 'inherit' })
} catch (e) {
  console.log(`::error::installing hammerkit@${version} failed: ${e.message}`)
  process.exit(1)
}
