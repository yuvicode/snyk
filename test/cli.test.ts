import * as _ from 'lodash';
import {test} from 'tap';
import * as testUtils from './utils';
import * as ciChecker from '../src/lib/is-ci';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import {parse} from 'url';
import * as policy from 'snyk-policy';
import stripAnsi from 'strip-ansi';
const port = process.env.PORT || process.env.SNYK_PORT || '12345';

const apiKey = '123456789';
const notAuthorizedApiKey = 'notAuthorized';
let oldkey;
let oldendpoint;
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';

// tslint:disable-next-line:no-var-requires
const server = require('./cli-server')(
  process.env.SNYK_API, apiKey, notAuthorizedApiKey,
);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as cli from '../src/cli/commands';

const before = test;
const after = test;

before('setup', (t) => {
  t.plan(3);
  cli.config('get', 'api').then((key) => {
    oldkey = key; // just in case
    t.pass('existing user config captured');
  });

  cli.config('get', 'endpoint').then((key) => {
    oldendpoint = key; // just in case
    t.pass('existing user endpoint captured');
  });

  server.listen(port, () => {
    t.pass('started demo server');
  });
});

before('prime config', (t) => {
  cli.config('set', 'api=' + apiKey).then(() => {
    t.pass('api token set');
  }).then(() => {
    return cli.config('unset', 'endpoint').then(() => {
      t.pass('endpoint removed');
    });
  }).catch(t.bailout).then(t.end);
});

test('cli tests for online repos', (t) => {
  t.plan(4);

  cli.test('semver@2').then((res) => {
    t.fail(res);
  }).catch((error) => {
    const res = error.message;
    const pos = res.toLowerCase().indexOf('vulnerability found');
    t.pass(res);
    t.notEqual(pos, -1, 'correctly found vulnerability: ' + res);
  });

  cli.test('semver@2', { json: true }).then((res) => {
    t.fail(res);
  }).catch((error) => {
    const res = JSON.parse(error.message);
    const vuln = res.vulnerabilities[0];
    t.pass(vuln.title);
    t.equal(vuln.id, 'npm:semver:20150403',
      'correctly found vulnerability: ' + vuln.id);
  });
});

test('cli tests erroring paths', { timeout: 3000 }, (t) => {
  t.plan(3);

  cli.test('/', { json: true }).then((res) => {
    t.fail(res);
  }).catch((error) => {
    const errObj = JSON.parse(error.message);
    t.ok(errObj.error.length > 1, 'should display error message');
    t.match(errObj.path, '/', 'path property should be populated');
    t.pass('error json with correct output when one bad project specified');
    t.end();
  });
});

test('monitor', (t) => {
  t.plan(1);

  cli.monitor().then((res) => {
    t.pass('monitor captured');
  }).catch((error) => {
    t.fail(error);
  });
});

test('monitor --json', (t) => {
  t.plan(3);

  cli.monitor(undefined, { json: true }).then((res) => {
    res = JSON.parse(res);

    if (_.isObject(res)) {
      t.pass('monitor outputed JSON');
    } else {
      t.fail('Failed parsing monitor JSON output');
    }

    const keyList = ['packageManager', 'manageUrl'];

    keyList.forEach((k) => {
      !_.get(res, k) ? t.fail(k + 'not found') :
        t.pass(k + ' found');
    });
  }).catch((error) =>  {
    t.fail(error);
  });
});

test('multiple test arguments', async (t) => {
  t.plan(4);

  cli.test('semver@4', 'qs@6').then((res) => {
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, no vulnerable paths were found.',
      'successfully tested semver@4, qs@6');
  }).catch((error) =>  {
    t.fail(error);
  });

  cli.test('semver@4', 'qs@1').then((res) => {
    t.fail(res);
  }).catch((error) =>  {
    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@4, qs@1');
  });

  cli.test('semver@2', 'qs@6').then((res) => {
    t.fail(res);
  }).catch((error) =>  {
    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@2, qs@6');
  });

  cli.test('semver@2', 'qs@1').then((res) => {
    t.fail(res);
  }).catch((error) =>  {
    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 2 contained vulnerable paths.',
      'successfully tested semver@2, qs@1');
  });
});

test('test for existing remote package with dev-deps only', async (t) => {
  try {
    const res = await cli.test('lodash@4.17.1');
    t.fail('should fail, instead received ' + res);
  } catch (error) {
    console.log(error);

    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equal(error.code, 200);
    t.match(lastLine, 'Failed to get vulns for package.');
  }
});

test('test for existing remote package with dev-deps only with --dev', async (t) => {
  try {
    const res = await cli.test('lodash@4.17.1', {dev: true});
    t.fail('should fail, instead received ' + res);
  } catch (error) {
    const res = error.message;
    console.log(error);
    const lastLine = res.trim().split('\n').pop();
    t.equal(error.code, 200);
    t.match(lastLine, 'Failed to get vulns for package.');
  }
});

test('test for non-existing package@version', (t) => {
  t.plan(1);

  cli.test('@123').then((res) => {
    t.fails('should fail, instead received ' + res);
  }).catch((error) =>  {
    t.equal(error.userMessage, 'Failed to get vulnerabilities. Are you sure this is a package?');
    t.equal(error.code, 404);
    t.match(error.message, 'Failed to get vulns for package.');
  });
});

test('snyk ignore - all options', (t) => {
  t.plan(1);
  const fullPolicy = {
    ID: [
      {
        '*': {
          reason: 'REASON',
          expires: new Date('2017-10-07T00:00:00.000Z'),
        },
      },
    ],
  };
  const dir = testUtils.tmpdir();
  cli.ignore({
    'id': 'ID',
    'reason': 'REASON',
    'expiry': new Date('2017-10-07'),
    'policy-path': dir,
  }).catch((err) => t.throws(err, 'ignore should succeed'))
    .then(() => policy.load(dir))
    .then((pol) => {
      t.deepEquals(pol.ignore, fullPolicy, 'policy written correctly');
    });
});

test('snyk ignore - no ID', (t) => {
  t.plan(1);
  const dir = testUtils.tmpdir();
  cli.ignore({
    'reason': 'REASON',
    'expiry': new Date('2017-10-07'),
    'policy-path': dir,
  }).then((res) => {
    t.fail('should not succeed with missing ID');
  }).catch((e) => {
    const errors = require('../src/lib/errors/legacy-errors');
    const message = stripAnsi(errors.message(e));
    t.equal(message.toLowerCase().indexOf('id is a required field'), 0,
      'captured failed ignore (no --id given)');
  });
});

test('snyk ignore - default options', (t) => {
  t.plan(3);
  const dir = testUtils.tmpdir();
  cli.ignore({
    'id': 'ID3',
    'policy-path': dir,
  }).catch(() => t.fail('ignore should succeed'))
    .then(() => policy.load(dir))
    .then((pol) => {
      t.true(pol.ignore.ID3, 'policy ID written correctly');
      t.is(pol.ignore.ID3[0]['*'].reason, 'None Given',
        'policy (default) reason written correctly');
      const expiryFromNow = pol.ignore.ID3[0]['*'].expires - Date.now();
      // not more than 30 days ahead, not less than (30 days - 1 minute)
      t.true(expiryFromNow <= 30 * 24 * 60 * 60 * 1000 &&
        expiryFromNow >= 30 * 24 * 59 * 60 * 1000,
        'policy (default) expiry wirtten correctly');
    });
});

test('snyk ignore - not authorized', (t) => {
  t.plan(1);
  const dir = testUtils.tmpdir();
  cli.config('set', 'api=' + notAuthorizedApiKey)
    .then(() => {
      return cli.ignore({
        'id': 'ID3',
        'policy-path': dir,
      });
    })
    .catch((err) => t.throws(err, 'ignore should succeed'))
    .then(() => policy.load(dir))
    .catch((err) => t.pass('no policy file saved'));
});

test('test without authentication', async (t) => {
  await cli.config('unset', 'api');
  try {
    await cli.test('semver@2');
    t.fail('test should not pass if not authenticated');
  } catch (error) {
    t.equal(error.code, 401, 'code is as expected');
    t.deepEquals(error.strCode, 'NO_API_TOKEN', 'string code is as expected');
    t.match(error.message,
      '`snyk` requires an authenticated account. Please run `snyk auth` and try again.',
      'error message is shown as expected');
  }
  await cli.config('set', 'api=' + apiKey);
});

test('auth via key', (t) => {
  t.plan(1);

  cli.auth(apiKey).then((res) => {
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  }).catch(t.threw);
});

test('auth via invalid key', (t) => {
  t.plan(1);

  const errors = require('../src/lib/errors/legacy-errors');

  cli.auth('_____________').then((res) => {
    t.fail('auth should not succeed: ' + res);
  }).catch((e) => {
    const message = stripAnsi(errors.message(e));
    t.equal(message.toLowerCase().indexOf('authentication failed'), 0, 'captured failed auth');
  });
});

test('auth via github', (t) => {
  let tokenRequest;

  const openSpy = sinon.spy((url) => {
    tokenRequest = parse(url);
    tokenRequest.token = tokenRequest.query.split('=').pop();
  });

  const auth = proxyquire('../src/cli/commands/auth', {
    open: openSpy,
  });
  sinon.stub(ciChecker, 'isCI').returns(false);

  const unhook = testUtils.silenceLog();

  auth().then((res) => {
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  }).catch(t.threw).then(() => {
    unhook();
    t.end();
  });
});

after('teardown', (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  server.close(() => {
    t.pass('server shutdown');
    let key = 'set';
    let value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    cli.config(key, value).then(() => {
      t.pass('user config restored');
      if (oldendpoint) {
        cli.config('endpoint', oldendpoint).then(() => {
          t.pass('user endpoint restored');
          t.end();
        });
      } else {
        t.pass('no endpoint');
        t.end();
      }
    });

  });
});
