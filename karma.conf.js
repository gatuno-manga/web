module.exports = (config) => {
	config.set({
		basePath: '',
		frameworks: ['jasmine'],
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-jasmine-html-reporter'),
			require('karma-coverage'),
		],
		client: {
			jasmine: {},
			clearContext: false,
		},
		coverageReporter: {},
		reporters: ['progress', 'kjhtml'],
		port: 9876,
		colors: true,
		logLevel: config.LOG_INFO,
		autoWatch: true,
		customLaunchers: {
			ChromeHeadlessCI: {
				base: 'ChromeHeadless',
				flags: [
					'--no-sandbox',
					'--disable-gpu',
					'--disable-dev-shm-usage',
				],
			},
		},
		browsers: ['ChromeHeadlessCI'],
		singleRun: true,
		restartOnFileChange: false,
	});
};
