
import * as fs from 'fs';
import * as path from 'path';
import * as dockerPlugin from 'snyk-docker-plugin';
import * as request from '../../../../src/lib/request/promise';
import { TestDepGraphResponse } from "../../../../src/lib/snyk-test/legacy";
import { ScanResult } from 'snyk-docker-plugin';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { convertTestDepGraphResultToLegacy } from '../../../../src/lib/snyk-test/legacy';
import { legacy } from '@snyk/dep-graph';


describe('container test --app-vulns --file=Dockerfile --exclude-base-image-vulns returns exit code 0', () => {
  const fixturePath = path.join(
    __dirname,
    '../../fixtures',
    'container-projects',
  );
  const cwd = process.cwd();

  function readFixture(filename: string) {
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf8');
  }

  function readJsonFixture(filename: string) {
    const contents = readFixture(filename);
    return JSON.parse(contents);
  }

  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    process.chdir(fixturePath);
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
    jest.resetAllMocks();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
    process.chdir(cwd);
  });

  it('should return the expected string and exit code 1', async () => {
    const mockDockerPluginScanResult = readJsonFixture(
      'app-vuln-project-docker-plugin-response.json',
    ) as ScanResult;
    const mockRegistryResponse = readJsonFixture(
      'app-vuln-project-registry-response.json',
    ) as TestDepGraphResponse;

    jest
    .spyOn(dockerPlugin, 'scan')
    .mockResolvedValue({ scanResults: [mockDockerPluginScanResult] });
    jest
    .spyOn(request, 'makeRequest')
    .mockResolvedValue(mockRegistryResponse);
  // const resultSpy = jest
  //   .spyOn(legacy, 'convertTestDepGraphResultToLegacy');
    
    const dockerfilePath = path.normalize(
      'test/acceptance/fixtures/docker/Dockerfile.nginx',
    );

    const { code, stdout } = await runSnykCLI(
      `container test nginx:1 --json --file=${dockerfilePath} --exclude-base-image-vulns`,
      {
        env,
      },
    );
    const jsonOutput = JSON.parse(stdout);

    // expect(resultSpy.mock.results[0]).toMatchObject({vulnd: 'CVE-3412412'})
    expect(jsonOutput.ok).toEqual(true);
    expect(code).toEqual(1);
  });
  
});