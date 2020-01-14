import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import { MultiProjectResultCustom } from '../get-multi-plugin-result';

export async function inspect(
  root: string,
  targetFile: string,
): Promise<MultiProjectResultCustom> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }

  return {
    plugin: {
      name: 'cpp',
    },
    scannedProjects: [
      {
        packageManager: 'cpp',
        targetFile,
        depTree: {
          name: 'cpp',
          targetFile,
          dependencies: {
            'binutils@2.30': {
              name: 'binutils',
              version: '2.31',
            },
          },
        },
      },
      {
        targetFile,
        depTree: {
          name: 'hello',
          targetFile,
          dependencies: {
            'mysql57@5.7.21-2.6.amzn1': {
              name: 'mysql57',
              version: '5.7.21-2.6.amzn1',
            },
          },
        },
        packageManager: 'rpm',
      },
      {
        targetFile,
        packageManager: 'upstream',
        depTree: {
          targetFile,
          name: 'hello',
          dependencies: {
            'apt/libapt-pkg5.0': {
              version: '1.6.3ubuntu0.1',
              dependencies: {
                'bzip2/libbz2-1.0': {
                  version: '1.0.6-8.1',
                },
              },
            },
            'bzip2/libbz2-1.0': {
              version: '1.0.6-8.1',
            },
            'iproute/iproute': {
              name: 'iproute/iproute',
              version: '20120521-3+b3',
              dependencies: {
                'db/libdb5.1': {
                  name: 'db/libdb5.1',
                  version: '5.1.29-5+deb7u1',
                },
              },
            },
            'iputils/iputils-ping': {
              name: 'iputils/iputils-ping',
              version: '3:20101006-1+b1',
              dependencies: {
                'openssl/libssl1.0.0': {
                  name: 'openssl/libssl1.0.0',
                  version: '1.0.1t-1+deb7u4',
                },
              },
            },
            apt: {
              name: 'apt',
              version: '0.9.7.9+deb7u7',
              dependencies: {
                'debian-archive-keyring': {
                  name: 'debian-archive-keyring',
                  version: '2014.3~deb7u1',
                  dependencies: {
                    'gnupg/gpgv': {
                      name: 'gnupg/gpgv',
                      version: '1.4.12-7+deb7u9',
                    },
                  },
                },
                gnupg: {
                  name: 'gnupg',
                  version: '1.4.12-7+deb7u9',
                  dependencies: {
                    'gnupg/gpgv': {
                      name: 'gnupg/gpgv',
                      version: '1.4.12-7+deb7u9',
                    },
                    'readline6/libreadline6': {
                      name: 'readline6/libreadline6',
                      version: '6.2+dfsg-0.1',
                      dependencies: {
                        'ncurses/libtinfo5': {
                          name: 'ncurses/libtinfo5',
                          version: '5.9-10',
                        },
                        'readline6/readline-common': {
                          name: 'readline6/readline-common',
                          version: '6.2+dfsg-0.1',
                        },
                      },
                    },
                    'libusb/libusb-0.1-4': {
                      name: 'libusb/libusb-0.1-4',
                      version: '2:0.1.12-20+nmu1',
                    },
                  },
                },
                'apt/libapt-pkg4.12': {
                  name: 'apt/libapt-pkg4.12',
                  version: '0.9.7.9+deb7u7',
                  dependencies: {
                    'gcc-4.7/libstdc++6': {
                      name: 'gcc-4.7/libstdc++6',
                      version: '4.7.2-5',
                    },
                  },
                },
                'gcc-4.7/libstdc++6': {
                  name: 'gcc-4.7/libstdc++6',
                  version: '4.7.2-5',
                },
              },
            },
            'base-files': {
              name: 'base-files',
              version: '7.1wheezy11',
              dependencies: {
                mawk: {
                  name: 'mawk',
                  version: '1.3.3-17',
                },
              },
            },
            'base-passwd': {
              name: 'base-passwd',
              version: '3.5.26',
            },
            bash: {
              name: 'bash',
              labels: {
                dockerLayerId: 'YWJjZGVmZ2hqampqanp6Zm1za2RmbnNsZnNuZGtmbHNuZnNr',
              },
              version: '4.2+dfsg-0.1+deb7u4',
              dependencies: {
                'base-files': {
                  name: 'base-files',
                  version: '7.1wheezy11',
                  dependencies: {
                    mawk: {
                      name: 'mawk',
                      version: '1.3.3-17',
                    },
                  },
                },
                dash: {
                  name: 'dash',
                  version: '0.5.7-3',
                  dependencies: {
                    debianutils: {
                      name: 'debianutils',
                      version: '4.3.2',
                      dependencies: {
                        'sensible-utils': {
                          name: 'sensible-utils',
                          version: '0.0.7+deb7u1',
                        },
                      },
                    },
                  },
                },
                debianutils: {
                  name: 'debianutils',
                  version: '4.3.2',
                  dependencies: {
                    'sensible-utils': {
                      name: 'sensible-utils',
                      version: '0.0.7+deb7u1',
                    },
                  },
                },
                'ncurses/libtinfo5': {
                  name: 'ncurses/libtinfo5',
                  version: '5.9-10',
                },
              },
            },
            'util-linux/bsdutils': {
              name: 'util-linux/bsdutils',
              version: '1:2.20.1-5.3',
            },
            coreutils: {
              name: 'coreutils',
              version: '8.13-3.5',
              dependencies: {
                'acl/libacl1': {
                  name: 'acl/libacl1',
                  version: '2.2.51-8',
                  dependencies: {
                    'attr/libattr1': {
                      name: 'attr/libattr1',
                      version: '1:2.4.46-8',
                    },
                  },
                },
                'attr/libattr1': {
                  name: 'attr/libattr1',
                  version: '1:2.4.46-8',
                },
              },
            },
            dash: {
              name: 'dash',
              version: '0.5.7-3',
              dependencies: {
                debianutils: {
                  name: 'debianutils',
                  version: '4.3.2',
                  dependencies: {
                    'sensible-utils': {
                      name: 'sensible-utils',
                      version: '0.0.7+deb7u1',
                    },
                  },
                },
              },
            },
            'debconf/debconf-i18n': {
              name: 'debconf/debconf-i18n',
              version: '1.5.49',
              dependencies: {
                'liblocale-gettext-perl/liblocale-gettext-perl': {
                  name: 'liblocale-gettext-perl/liblocale-gettext-perl',
                  version: '1.05-7+b1',
                },
                'libtext-charwidth-perl/libtext-charwidth-perl': {
                  name: 'libtext-charwidth-perl/libtext-charwidth-perl',
                  version: '0.04-7+b1',
                },
                'libtext-iconv-perl': {
                  name: 'libtext-iconv-perl',
                  version: '1.7-5',
                },
                'libtext-wrapi18n-perl': {
                  name: 'libtext-wrapi18n-perl',
                  version: '0.06-7',
                  dependencies: {
                    'libtext-charwidth-perl/libtext-charwidth-perl': {
                      name: 'libtext-charwidth-perl/libtext-charwidth-perl',
                      version: '0.04-7+b1',
                    },
                  },
                },
              },
            },
            'debian-archive-keyring': {
              name: 'debian-archive-keyring',
              version: '2014.3~deb7u1',
              dependencies: {
                'gnupg/gpgv': {
                  name: 'gnupg/gpgv',
                  version: '1.4.12-7+deb7u9',
                },
              },
            },
            debianutils: {
              name: 'debianutils',
              version: '4.3.2',
              dependencies: {
                'sensible-utils': {
                  name: 'sensible-utils',
                  version: '0.0.7+deb7u1',
                },
              },
            },
            diffutils: {
              name: 'diffutils',
              version: '1:3.2-6',
            },
            'e2fsprogs/e2fslibs': {
              name: 'e2fsprogs/e2fslibs',
              version: '1.42.5-1.1+deb7u1',
            },
          },
        },
      },
    ],
  };
}
