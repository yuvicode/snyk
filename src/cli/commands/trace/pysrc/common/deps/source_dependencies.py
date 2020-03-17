import logging

from common.utils import is_source_file


def identify_source_dependencies(build_graph, candidate_nodes):
    """
    Identifies which build graph candidate nodes correspond to source dependencies.

    The identification is performed by traversing the build graph from each candidate node. For each node, we check
    if the nodes has source files as its children. If so, we identify it as a "source dependency". If not, we classify
    it as "unidentified".
    """

    sources_by_source_dep = dict()
    unidentified_nodes = set()

    for root_node in candidate_nodes:
        source_nodes = _get_source_files(build_graph, root_node, candidate_nodes)
        if len(source_nodes) == 0:
            unidentified_nodes.add(root_node)
        else:
            logging.debug('Found {} sources for dependency {}'.format(len(source_nodes), root_node))
            sources_by_source_dep[root_node] = source_nodes

    return sources_by_source_dep, unidentified_nodes


def _get_source_files(deps_graph, root_node, all_root_nodes):
    logging.debug('Attempting to find source directory for  {}'.format(root_node))

    source_files = set()
    nodes_to_visit_queue = [root_node]

    # in case there is a loop in the graph
    nodes_already_visited = set()

    while len(nodes_to_visit_queue) > 0:
        cur_node = nodes_to_visit_queue.pop()
        if cur_node in nodes_already_visited:
            continue

        nodes_already_visited.add(cur_node)
        if is_source_file(cur_node):
            source_files.add(cur_node)

        else:
            node_children = deps_graph.predecessors(cur_node)
            for child in node_children:
                if child in all_root_nodes:
                    # if the child is another root node, we skip it, otherwise if we have a dependency
                    # lib1.so -> lib2.so, we would include all of lib2.so source in lib1.so list
                    continue
                else:
                    nodes_to_visit_queue.append(child)

    return source_files
