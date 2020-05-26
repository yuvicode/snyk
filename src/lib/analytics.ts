export = analytics;
analytics.single = postAnalytics;

import * as snyk from '../lib';
import * as config from './config';
import * as version from './version';
import request = require('./request');
import { isCI } from './is-ci';
import * as debugModule from 'debug';
import * as os from 'os';
import osName = require('os-name');
import * as crypto from 'crypto';
import * as uuid from 'uuid';
import stripAnsi from 'strip-ansi';

const debug = debugModule('snyk');

const metadata = {};
// analytics module is required at the beginning of the CLI run cycle
const startTime = Date.now();

function analytics(data) {
  if (!data) {
    data = {};
  }

  analytics.add('integrationName', process.env.SNYK_INTEGRATION_NAME || '');
  analytics.add(
    'integrationVersion',
    process.env.SNYK_INTEGRATION_VERSION || '',
  );

  // merge any new data with data we picked up along the way
  if (Array.isArray(data.args)) {
    // this is an overhang from the cli/args.js and we don't want it
    delete (data.args.slice(-1).pop() || {})._;
  }

  if (Object.keys(metadata).length) {
    data.metadata = metadata;
  }

  return postAnalytics(data);
}

function postAnalytics(data) {
  // if the user opt'ed out of analytics, then let's bail out early
  // ths applies to all sending to protect user's privacy
  if (snyk.config.get('disable-analytics') || config.DISABLE_ANALYTICS) {
    debug('analytics disabled');
    return Promise.resolve();
  }

  // get snyk version
  return version
    .getVersion()
    .then((version) => {
      data.version = version;
      data.os = osName(os.platform(), os.release());
      data.nodeVersion = process.version;

      const seed = uuid.v4();
      const shasum = crypto.createHash('sha1');
      data.id = shasum.update(seed).digest('hex');

      const headers: any = {};
      if (snyk.api) {
        headers.authorization = 'token ' + snyk.api;
      }

      data.ci = isCI();
      data.durationMs = Date.now() - startTime;

      const queryStringParams: any = {};
      if (data.org) {
        queryStringParams.org = data.org;
      }

      debug('analytics', data);

      const queryString =
        Object.keys(queryStringParams).length > 0
          ? queryStringParams
          : undefined;

      return request({
        body: {
          data: data,
        },
        qs: queryString,
        url: config.API + '/analytics/cli',
        json: true,
        method: 'post',
        headers: headers,
      });
    })
    .catch((error) => {
      debug('analytics', error); // this swallows the analytics error
    });
}

analytics.add = function(key, value) {
  if (typeof value === 'string') {
    value = stripAnsi(value);
  }
  if (metadata[key]) {
    if (!Array.isArray(metadata[key])) {
      metadata[key] = [metadata[key]];
    }
    metadata[key].push(value);
  } else {
    metadata[key] = value;
  }
};
