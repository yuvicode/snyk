import itertools
import logging
import os

import networkx as nx

from common.fingerprinting import fingerprint_file
from common.trace_parser import ParsedAltName, ParsedCompiler, ParsedAr, ParsedLd, ParsedAs
from common.utils import resolve_path, is_source_file


def create_build_graph(parsed_commands, system_paths, convert_crlf_when_fingerprinting):
    """
    Creates the build graph from the parsed commands.

    The build graph is a graph where nodes are files participating in the build processes, and an edge from file1 to
    file2 represents that file2 was created from file1. For example, if you have file.c (a source file), this will
    always be the leaf of the build graph. If you compile file.c into file.o, file.o will also be a node in the graph,
    and you would have an edge file.c -> file.o. If you then assemble file.o into lib.so, again there
    would be an edge file.o -> lib.o.

    The output nodes contain file names, and file fingerprints. Note, we collect fingerprints for ALL files in the
    build graph, i.e. we would collect fingerprints for both binary files and source files, as well as other files
    which are intermediate representation between binary and source (.o files etc). Note, some files might be missing
    at this point, because they were deleted by the build script. In that case, we dont have any fingerprints for them.

    The major complication here is that the build script might have moved, copied or linked files. We want to identify
    such cases, and create a single node to represent such files. This is the job of `_get_artifacts_alternative_paths`
    method.

    For all other edge-cases, please read tests for this class.

    TODO: this can be simplified for sure, ideas:
        * refactor the code - this code has never been refactored after it was written, and while writing the code,
          new assumptions were uncovered (hence its complicated). Now we know all edge-cases, we can simplify the code.
        * do not look at low-level build commands (e.g. `as`). Instead look at the `gcc` command, to figure out which
          object was compiled from which source file. This might simplify the algorithm. Need to be careful - will
          this work with clang?
    """
    alt_file_paths = _get_artifacts_alternative_paths(parsed_commands)

    build_graph_creator = _BuildGraphCreator(
        alt_file_paths=alt_file_paths,
        system_paths=system_paths,
        convert_crlf_when_fingerprinting=convert_crlf_when_fingerprinting)

    return build_graph_creator.create_build_graph(parsed_commands)


# a helper class for carrying over node data to add to the graph
class _BuildGraphNodeData:
    def __init__(self, artifact_path, artifact_fingerprint):
        self.artifact_path = artifact_path
        self.artifact_fingerprint = artifact_fingerprint


# helper class for creating the build graph, exists only for readability purpose
class _BuildGraphCreator:
    def __init__(self, alt_file_paths, system_paths, convert_crlf_when_fingerprinting):
        self._alt_file_paths = alt_file_paths
        self._system_paths = system_paths
        self._convert_crlf_when_fingerprinting = convert_crlf_when_fingerprinting

        self._nodes_by_path = dict()
        self._nodes_by_fingerprint = dict()

    def create_build_graph(self, parsed_commands):
        parsed_commands = [cmd
                           for cmd in parsed_commands
                           if type(cmd) in {ParsedAr, ParsedCompiler, ParsedLd, ParsedAs}]

        build_graph = nx.DiGraph()

        for cmd in parsed_commands:
            # input_nodes and output_node are of type _BuildGraphNodeData, but we don't add _BuildGraphNodeData
            # as nodes to the graph as its harder to serialize, instead we add path as key and fingerprint as attribute
            input_nodes, output_node = self._get_nodes(cmd)
            if output_node is None:
                logging.debug('Unable to create build graph for cmd {} with output {}'.format(cmd.cmd, cmd.output))
                continue

            # if nodes / edges are already present in the graph the add functions are no-ops
            build_graph.add_node(output_node.artifact_path, fingerprint=output_node.artifact_fingerprint)

            for input_node in input_nodes:
                build_graph.add_node(input_node.artifact_path, fingerprint=input_node.artifact_fingerprint)
                build_graph.add_edge(input_node.artifact_path, output_node.artifact_path)

        return build_graph

    def _get_nodes(self, cmd):
        input_nodes = {self._create_file_node(cmd_input, cmd.pwd) for cmd_input in cmd.inputs}

        if type(cmd) is ParsedLd:
            lib_nodes = {self._create_lib_node(lib, cmd.paths) for lib in cmd.libs}
            input_nodes = input_nodes.union(lib_nodes)

        input_nodes = {input_node for input_node in input_nodes if input_node is not None}

        if cmd.output is None:
            output_node = None
        else:
            output_node = self._create_file_node(cmd.output, cmd.pwd)

        return input_nodes, output_node

    def _create_file_node(self, file_relative_path, command_pwd):
        # candidates consist of the actual resolved input file, as well as all alternative file paths
        resolved_file_path = resolve_path(command_pwd, file_relative_path)
        alternative_file_paths = self._alt_file_paths.get(resolved_file_path, set())

        candidate_paths = alternative_file_paths.union({resolved_file_path})
        return self._create_graph_node(candidate_paths)

    def _create_lib_node(self, lib_name, command_additional_paths):
        # We will search for the library file in all system paths, as well as in all
        # additional paths supplied to the command (e.g. through -L<..>). We will
        # try to guess the name by adding known suffixes to the lib name
        candidate_lib_names = {
            'lib' + lib_name + '.a',
            'lib' + lib_name + '.so'
        }
        search_paths = list(self._system_paths) + list(command_additional_paths)

        candidate_paths = {
            resolve_path(search_path, lib_name)
            for lib_name, search_path in itertools.product(candidate_lib_names, search_paths)
        }

        return self._create_graph_node(candidate_paths)

    def _create_graph_node(self, candidate_paths):
        if len(candidate_paths) == 0:
            return None

        # if node for path already exists in graph, return that immediately
        for candidate_path in candidate_paths:
            if candidate_path in self._nodes_by_path:
                return self._nodes_by_path[candidate_path]

        # if not, lets pick any path which exists on the file system, and create a node from it
        chosen_candidate_path = _find_path_which_exists(candidate_paths)

        # If no path exists on the file system, lets just pick any path and create a node from it. We would not
        # be able to fingerprint such file. Unfortunately, we do need to support non-existing paths because
        # some commands ('as') would output files to tmp folder, which are then removed after the build process exists.
        if chosen_candidate_path is None:
            # this just chooses any element from the set
            chosen_candidate_path = next(iter(candidate_paths))
            candidate_path_fp = None

        # otherwise we have a path which does exist, we fingerprint it first
        else:
            candidate_path_fp = self._fingerprint(chosen_candidate_path)

            # if a node with the same fingerprint exists, we return it. This can happen when, for example, we run
            # make install for an already installed library: we would have a node with path /build_dir/lib.a and also
            # a node with path /install_dir/lib.a - we want to store it once in the graph.
            if candidate_path_fp in self._nodes_by_fingerprint:
                return self._nodes_by_fingerprint[candidate_path_fp]

        # finally, since we haven't found any other matches in the graph, we would create a new node
        new_node = _BuildGraphNodeData(chosen_candidate_path, candidate_path_fp)
        self._nodes_by_path[chosen_candidate_path] = new_node
        if candidate_path_fp is not None:
            self._nodes_by_fingerprint[candidate_path_fp] = new_node

        return new_node

    def _fingerprint(self, file_path):
        if is_source_file(file_path):
            return fingerprint_file(file_path, self._convert_crlf_when_fingerprinting)
        else:
            # we do not need to convert file endings for binary files
            return fingerprint_file(file_path, convert_crlf=False)


def _get_artifacts_alternative_paths(parsed_commands):
    alt_path_commands = [cmd for cmd in parsed_commands if type(cmd) is ParsedAltName]

    alt_names = {}
    for alt_path_command in alt_path_commands:
        # see the explanation in the parser - basically these commands can have two modes
        if alt_path_command.target is not None:
            source = resolve_path(alt_path_command.pwd, alt_path_command.sources[0])
            target = resolve_path(alt_path_command.pwd, alt_path_command.target)
            _add_to_bidirectional_dict(alt_names, source, target)
        else:
            for source_name in alt_path_command.sources:
                source = resolve_path(alt_path_command.pwd, source_name)
                target = resolve_path(alt_path_command.target_directory, source_name)
                _add_to_bidirectional_dict(alt_names, source, target)

    return alt_names


def _add_to_bidirectional_dict(dictionary, lhs, rhs):
    if lhs not in dictionary:
        dictionary[lhs] = set()
    dictionary[lhs].add(rhs)

    if rhs not in dictionary:
        dictionary[rhs] = set()
    dictionary[rhs].add(lhs)


def _find_path_which_exists(file_paths):
    for candidate_path in file_paths:
        if os.path.isfile(candidate_path):
            return candidate_path

    return None
