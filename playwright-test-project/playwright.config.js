module.exports = {
  testDir: './tests',
  reporter: [
    [
      '../dist/src/SlackReporter.js',
      {
        sendResults: 'always',
        channels: ['test-channel'],
        // For testing, use a webhook or set the environment variable
        // slackWebHookUrl: 'YOUR_SLACK_WEBHOOK_URL',
        meta: [
          {
            key: 'Test Run',
            value: 'Bug & Recovered Status Test'
          }
        ],
        maxNumberOfFailuresToShow: 10
      }
    ]
  ],
  use: {
    browserName: 'chromium'
  }
};