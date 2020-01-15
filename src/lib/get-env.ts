const ciEnvs = new Set([
    'INTEGRATION_PLUGIN_NAME',
  ]);

  export function getEnvs(): Object {
    let ret = {};
    Object.keys(process.env).forEach(k => {
      if (ciEnvs.has(k)) {
        ret[k] = process.env[k]
      }
    });
    return ret;
  }
