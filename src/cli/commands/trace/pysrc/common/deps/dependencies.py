import logging
import os
import re
import subprocess

from common.deps.build_graph import create_build_graph
from common.deps.os_packages import get_os_packages
from common.deps.source_dependencies import identify_source_dependencies
from common.utils import is_lib_file, is_object_file


def create_manifake(parsed_commands, convert_crlf_when_fingerprinting):
    system_paths = _get_lib_system_paths()
    build_graph = create_build_graph(parsed_commands, system_paths, convert_crlf_when_fingerprinting)

    print('**************************')
    print(build_graph)
    print('**************************');
    nodes_to_identify = _get_nodes_to_identify(build_graph)
    source_files_by_node, unidentified_nodes = identify_source_dependencies(build_graph, nodes_to_identify)
    os_packages_by_node, unidentified_nodes = get_os_packages(unidentified_nodes)

    return _get_manifake_json(os_packages_by_node, source_files_by_node, build_graph)


def _get_nodes_to_identify(build_graph):
    """
    Returns build nodes which are relevant for dependency identification.
    I.e. we will look for dependencies only associated with these nodes.
    """
    nodes_to_identify = set()

    for node in build_graph.nodes:
        # 1. we consider all lib files to be candidates for identification
        if is_lib_file(node):
            nodes_to_identify.add(node)

        # we also consider all object files which do not have any children, i.e. were not compiled by
        # anything, as they likely come from the operating system
        elif is_object_file(node) and len(list(build_graph.predecessors(node))) == 0:
            nodes_to_identify.add(node)

    return nodes_to_identify


def _get_lib_system_paths():
    s = _run_gcc_print_search_dirs()
    system_paths = re.findall(r"libraries:\s*=\s*(.*)\s*", s)[0].split(':')

    system_paths = {os.path.abspath(p) for p in system_paths}

    logging.debug('Found the following lib system paths:\n' + '\n'.join(['  ' + p for p in system_paths]))
    return system_paths


def _run_gcc_print_search_dirs():
    output = subprocess.run([
        'gcc', '--print-search-dirs'],
        universal_newlines=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT).stdout

    logging.debug('Output of gcc --print-search-dirs was: ' + output)
    return output


def _get_manifake_json(os_packages_by_node, source_files_by_node, build_graph):
    manifake_json = dict()
    os_deps_added = set()
    os_dependencies = []
    for package in os_packages_by_node.values():
        if (package.source, package.version) in os_deps_added:
            continue
        else:
            os_deps_added.add((package.source, package.version))

        os_dep_info = {
            "package_name": package.source,
            "package_version": package.version
        }
        os_dependencies.append(os_dep_info)

    source_dependencies = {dep: [_source_node_manifake_json(source, build_graph) for source in sources]
                           for dep, sources in source_files_by_node.items()}
    manifake_json['os_dependencies'] = os_dependencies
    manifake_json['source_dependencies'] = source_dependencies
    return manifake_json


def _source_node_manifake_json(source_node, build_graph):
    fp = build_graph.nodes[source_node].get('fingerprint', None)
    return {
        'file_path': source_node,
        'fingerprint': fp
    }
