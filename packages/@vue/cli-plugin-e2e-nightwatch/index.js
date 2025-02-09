module.exports = (api, options) => {
  api.registerCommand('test:e2e', {
    description: 'run e2e tests with nightwatch',
    usage: 'vue-cli-service test:e2e [options]',
    options: {
      '--url': 'run e2e tests against given url instead of auto-starting dev server',
      '--config': 'use custom nightwatch config file (overrides internals)',
      '-e, --env': 'specify comma-delimited browser envs to run in (default: chrome)',
      '-t, --test': 'specify a test to run by name',
      '-f, --filter': 'glob to filter tests by filename'
    },
    details:
      `All Nightwatch CLI options are also supported.\n` +
      `https://nightwatchjs.org/guide#command-line-options`
  }, (args, rawArgs) => {
    removeArg(rawArgs, 'url')
    removeArg(rawArgs, 'mode')

    const serverPromise = args.url
      ? Promise.resolve({ url: args.url })
      : api.service.run('serve')

    return serverPromise.then(({ server, url }) => {
      // expose dev server url to tests
      process.env.VUE_DEV_SERVER_URL = url
      if (rawArgs.indexOf('--config') === -1) {
        // expose user options to config file
        const fs = require('fs')
        let userOptionsPath, userOptions
        if (fs.existsSync(userOptionsPath = api.resolve('nightwatch.config.js'))) {
          userOptions = require(userOptionsPath)
        } else if (fs.existsSync(userOptionsPath = api.resolve('nightwatch.json'))) {
          userOptions = require(userOptionsPath)
        } else if (fs.existsSync(userOptionsPath = api.resolve('nightwatch.conf.js'))) {
          userOptions = require(userOptionsPath)
        }
        process.env.VUE_NIGHTWATCH_USER_OPTIONS = JSON.stringify(userOptions || {})

        rawArgs.push('--config', require.resolve('./nightwatch.config.js'))
      }

      if (rawArgs.indexOf('--env') === -1 && rawArgs.indexOf('-e') === -1) {
        rawArgs.push('--env', 'chrome')
      }

      const execa = require('execa')
      const nightWatchBinPath = require.resolve('nightwatch/bin/nightwatch')
      const runner = execa(nightWatchBinPath, rawArgs, { stdio: 'inherit' })
      if (server) {
        runner.on('exit', () => server.close())
        runner.on('error', () => server.close())
      }

      if (process.env.VUE_CLI_TEST) {
        runner.on('exit', code => {
          process.exit(code)
        })
      }

      return runner
    })
  })
}

module.exports.defaultModes = {
  'test:e2e': 'production'
}

function removeArg (rawArgs, argToRemove, offset = 1) {
  const matchRE = new RegExp(`^--${argToRemove}`)
  const equalRE = new RegExp(`^--${argToRemove}=`)
  const i = rawArgs.findIndex(arg => matchRE.test(arg))
  if (i > -1) {
    rawArgs.splice(i, offset + (equalRE.test(rawArgs[i]) ? 0 : 1))
  }
}
