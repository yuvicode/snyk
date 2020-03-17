#!/usr/bin/env python3
import argparse
import json
import logging

from common.deps.dependencies import create_manifake
from common.trace_parser import parse_tracer_log
from common.utils import configure_logger


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--tracer-log-path',
        required=True,
        help='the path to the tracer.log file to parse'
    )

    parser.add_argument(
        '--disable-crlf',
        action='store_true',
        default=False,
        help='if supplied, the script will disable conversion of source-files line-seperators '
             'from windows-style to unix-style (e.g. "\r\n" -> "\n") before calculating hashes'
    )

    parser.add_argument(
        '--manifake-output-path',
        required=True,
        help='the location of the output manifake.json file, which contains all dependencies'
    )

    parser.add_argument('--verbose', action='store_true', default=False)

    args = parser.parse_args()

    configure_logger(args.verbose)

    parsed_commands = parse_tracer_log(args.tracer_log_path)
    logging.debug('Parsed the tracer log {}, found {} relevant calls'.format(args.tracer_log_path, len(parsed_commands)))

    deps_json = create_manifake(
        parsed_commands,
        convert_crlf_when_fingerprinting=not args.disable_crlf)

    with open(args.manifake_output_path, 'w') as outfile:
        json.dump(deps_json, outfile)


if __name__ == '__main__':
    main()
