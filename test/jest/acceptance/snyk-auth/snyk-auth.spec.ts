import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { removeAuth } from '../../util/removeAuth';

jest.setTimeout(1000 * 60);

describe('snyk auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_TOKEN: '123456789', // replace token from process.env
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('accepts valid token', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setDepGraphResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`auth ${server.getSnykToken()}`, {
      cwd: project.path(),
      env: removeAuth(project, env),
    });

    expect(code).toEqual(0);
    expect(stdout).toMatch('Your account has been authenticated.');
  });

  it('rejects invalid token', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setDepGraphResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`auth invalid-token`, {
      cwd: project.path(),
      env: removeAuth(project, env),
    });

    expect(code).toEqual(2);
    expect(stdout).toMatch('Authentication failed.');
  });
});
