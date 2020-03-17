import logging
import subprocess
from collections import namedtuple

DebPackage = namedtuple('DebPackage', 'binary source version')


def get_os_packages(unidentified_nodes):
    """
    Identifies which build graph nodes correspond to os dependencies.

    It is assumed that the input nodes only correspond to binaries (i.e. .a files or .so files). For each such input
    node, we try to identify it using `dpkg` - debian package manager. If dpkg recognises the input node as something
    it manages, we assume it is an "os dependency". If not, we classify it as "unidentified".

    # TODO this does not work for cross-compiler. Fix was done here, but never merged:
    # https://github.com/snyk/tracer/compare/fix/support-cross-compiler#diff-d7891374c3d2deae2ef111e316217b14R80
    """
    os_packages_by_node = dict()
    unidentified_binaries = set()

    for node in unidentified_nodes:
        dpkg_output = _run_dpkg(node)
        pkg_name = dpkg_output.split(':')[0]

        if pkg_name == 'dpkg-query':
            unidentified_binaries.add(node)

        else:
            dpkg_query_output = _run_dpkg_query(pkg_name)
            package = DebPackage(*dpkg_query_output.splitlines())
            if package.source is None or package.source == "":
                package = DebPackage(package.binary, package.binary, package.version)

            logging.debug('For input {} found package {}'.format(node, package))
            os_packages_by_node[node] = package

    return os_packages_by_node, unidentified_binaries


def _run_dpkg(binary_path):
    dpkg_command = 'dpkg -S {}'.format(binary_path)
    output = subprocess.run(
        dpkg_command.split(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True).stdout

    logging.debug('Run {cmd}, got: {output}'.format(cmd=dpkg_command, output=output))
    return output


def _run_dpkg_query(pkg_name):
    output = subprocess.run(
        ['dpkg-query', '--showformat=${Package}\n${Source}\n${Version}', '--show', pkg_name],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True).stdout

    logging.debug('Run dpkg-query for {}, found {}'.format(pkg_name, output.replace('\n', ' ')))
    return output