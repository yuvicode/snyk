import * as dockerPlugin from 'snyk-docker-plugin';
import * as rubygemsPlugin from './rubygems';
import * as mvnPlugin from 'snyk-mvn-plugin';
import * as gradlePlugin from 'snyk-gradle-plugin';
import * as sbtPlugin from 'snyk-sbt-plugin';
import * as pythonPlugin from 'snyk-python-plugin';
import * as goPlugin from 'snyk-go-plugin';
import * as nugetPlugin from 'snyk-nuget-plugin';
import * as phpPlugin from 'snyk-php-plugin';
import * as nodejsPlugin from './nodejs-plugin';
import * as types from './types';
import {SupportedPackageManagers} from '../package-managers';
// import * as path from 'path';

export function loadPlugin(packageManager: SupportedPackageManagers,
                           options: types.Options = {}): types.Plugin {
  if (options.docker) {
    return dockerPlugin;
  }

  switch (packageManager) {
    case 'npm':
    case 'yarn': {
      return nodejsPlugin;
    }
    case 'rubygems': {
      return rubygemsPlugin;
    }
    case 'maven': {
      return mvnPlugin;
    }
    case 'gradle': {
      return gradlePlugin;
    }
    case 'sbt': {
      return sbtPlugin;
    }
    case 'pip': {
      return pythonPlugin;
    }
    case 'golangdep':
    case 'gomodules':
    case 'govendor': {
      return goPlugin;
    }
    case 'nuget': {
      return nugetPlugin;
    }
    case 'paket': {
      return nugetPlugin;
    }
    case 'composer': {
      return phpPlugin;
    }
    default: {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }
}

export function getPluginOptions(packageManager: string, options: types.Options): types.Options {
  const pluginOptions: types.Options = {};
  switch (packageManager) {
    case 'gradle': {
      if (options['all-sub-projects']) {
        pluginOptions.multiDepRoots = true;
      }
      return pluginOptions;
    }
    default: {
      return pluginOptions;
    }
  }
}

export function getPluginHelpTxt(packageManager: string): string {
  switch (packageManager) {
    case 'sbt': {
      return sbtPlugin.help;
    }
    default: {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }
}

// export function getPluginHelpTxt(packageManager: string): string {
//   switch (packageManager) {
//     case 'npm':
//     case 'yarn': {
//       return path.resolve('./nodejs-plugin/README.md');
//     }
//     case 'rubygems': {
//       return path.resolve('./rubygems/README.md');
//     }
//     case 'maven': {
//       return path.resolve('../../../node_modules/snyk-mvn-plugin/README.md');
//     }
//     case 'gradle': {
//       return path.resolve('../../../node_modules/snyk-gradle-plugin/README.md');
//     }
//     case 'sbt': {
//       return path.resolve('../../../node_modules/snyk-sbt-plugin/README.md');
//     }
//     case 'pip': {
//       return path.resolve('../../../node_modules/snyk-python-plugin/README.md');
//     }
//     case 'golangdep':
//     case 'gomodules':
//     case 'govendor': {
//       return path.resolve('../../../node_modules/snyk-go-plugin/README.md');
//     }
//     case 'nuget':
//     case 'paket': {
//       return path.resolve('../../../node_modules/snyk-nuket-plugin/README.md');
//     }
//     case 'composer': {
//       return path.resolve('../../../node_modules/snyk-php-plugin/README.md');
//     }
//     case 'docker': {
//       return path.resolve('../../../node_modules/snyk-docker-plugin/README.md');
//     }
//     default: {
//       throw new Error(`Unsupported package manager: ${packageManager}`);
//     }
//   }
// }
