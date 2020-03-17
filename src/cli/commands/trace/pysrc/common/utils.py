import logging
import os
import re
from os import path


DEFAULT_ENCODING = 'utf-8'


def configure_logger(verbose):
    log_level = 'INFO'
    if verbose:
        log_level = 'DEBUG'
    logging.basicConfig(level=log_level, format='%(asctime)s %(message)s')


# e.g. with_respect_to_dir = '/tmp/chris/source' path = '../../', the output would be '/tmp'
def resolve_path(with_respect_to_dir, path_to_resolve):
    return path.abspath(path.join(with_respect_to_dir, path_to_resolve))


def is_source_file(file_path):
    return os.path.splitext(file_path)[-1].lower() in [
        '.c', '.cc', '.cpp', '.cxx', '.c++',
        '.h', '.hh', '.hpp', '.hxx', '.h++',
        '.ii', '.ixx', '.ipp', '.txx', '.tpp', '.tpl']


def is_object_file(file_path):
    return re.match(r"^.*(\.o|\.obj|\.out)$", file_path.lower())


def is_lib_file(file_path):
    return re.match(r".*(\.(so|a))", file_path.lower())
