from sys import argv;
import argparse
import json
import re
from common.utils import DEFAULT_ENCODING, is_source_file, is_object_file, is_lib_file

parse_tracer_log()

def parse_tracer_log():
    """
    Parses the tracer log file into a collection of objects, each representing a parsed build command.

    The returned list contains an object per parsed command, e.g. for `ld` command, it would return `ParsedLd` object.
    """
    tracer_log_path = argv[1]
    if not tracer_log_path:
        raise ValueError('Tracer log path must be provided!')
    with open(tracer_log_path, encoding=DEFAULT_ENCODING) as tracer_log:
        full_content = tracer_log.read()
        json_content = json.loads(full_content)
        parsed_calls = [_parse_tracer_file_entry(entry) for entry in json_content]
        return list(filter(None, parsed_calls))


class ParsedLd:

class ParsedAr:
    def __init__(self, cmd, pwd, inputs, output):
        self.cmd = cmd
        self.pwd = pwd
        self.inputs = inputs
        self.output = output


class ParsedCompiler:
    def __init__(self, cmd, pwd, inputs, output):
        self.cmd = cmd
        self.pwd = pwd
        self.inputs = inputs
        self.output = output


class ParsedAs:
    def __init__(self, cmd, pwd, inputs, output):
        self.cmd = cmd
        self.pwd = pwd
        self.inputs = inputs
        self.output = output


class ParsedAltName:
    def __init__(self, cmd, pwd, sources, target, target_directory):
        self.cmd = cmd
        self.pwd = pwd
        self.sources = sources
        self.target = target
        self.target_directory = target_directory


def _parse_alt_name(args, cmd, pwd):
    positional_args = [arg for arg in args if not arg.startswith('-')]
    if len(positional_args) < 2:
        raise Exception('Unable to parse args for cmd {}. Args: {}'.format(cmd, args))

    # two possible modes, either copy / move / link file from arg[0] to arg[1] OR
    # copy / move / link all files arg[0] ... arg[n-1] to directory arg[n]
    if len(positional_args) == 2:
        return ParsedAltName(
            cmd=cmd,
            pwd=pwd,
            sources=[positional_args[0]],
            target=positional_args[1],
            target_directory=None)

    else:
        return ParsedAltName(
            cmd=cmd,
            pwd=pwd,
            sources=positional_args[0:-1],
            target=None,
            target_directory=positional_args[-1])


def _parse_ld(args):
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('-o', dest='output')
    parser.add_argument('-L', dest='paths', action='append', default=[])
    parser.add_argument('-l', dest='libs', action='append', default=[])

    # adding the argument here just to consume it and make sure that the input to -soname
    # doesn't get confused with command inputs
    parser.add_argument('-soname', dest='soname', action='append', default=None)

    (parsed_ld_inputs, therest) = parser.parse_known_args(args)

    # we also consider .lo files as ld inputs, as we've .o files renamed to .lo files in some traces
    setattr(parsed_ld_inputs,
            'inputs',
            [x for x in therest if is_object_file(x) or is_lib_file(x) or re.match(r".*(\.lo)", x.lower())])

    return parsed_ld_inputs


def _parse_ar(args):
    parser = argparse.ArgumentParser(add_help=False)
    (parsed, therest) = parser.parse_known_args(args)

    setattr(parsed, 'inputs', [x for x in therest if is_object_file(x)])

    outputs = [x for x in therest if is_lib_file(x)]
    setattr(parsed, 'output', outputs[0] if outputs else None)
    return parsed


def _parse_compiler(args):
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('-o', dest='output')

    # this gets passed the name of the source file (but without any directory), which is useless for
    # us, but consuming it here to make sure we don't include it in inputs
    parser.add_argument('-dumpbase', dest='dumpbase', default=None)

    (parsed, therest) = parser.parse_known_args(args)

    setattr(parsed, 'inputs', [x for x in therest if is_source_file(x)])
    return parsed


def _parse_as(args):
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('-o', dest='output')

    (parsed, therest) = parser.parse_known_args(args)

    setattr(parsed, 'inputs', [x for x in therest if re.match(r".*(\.s)", x.lower())])
    return parsed


def _parse_tracer_file_entry(json_entry):
    (pwd, cmd, args) = json_entry["pwd"], json_entry["cmd"], json_entry["args"]

    if cmd.endswith('ld') or cmd.endswith('ld.bfd') or cmd.endswith('ld.gold'):
        parsed = _parse_ld(args)
        return ParsedLd(cmd=cmd, pwd=pwd, **parsed.__dict__)
    elif cmd.endswith('ar'):
        parsed = _parse_ar(args)
        return ParsedAr(cmd=cmd, pwd=pwd, **parsed.__dict__)
    elif cmd.endswith('cc1') or cmd.endswith('cc1plus'):
        parsed = _parse_compiler(args)
        return ParsedCompiler(cmd=cmd, pwd=pwd, inputs=parsed.inputs, output=parsed.output)
    elif cmd.endswith('as'):
        parsed = _parse_as(args)
        return ParsedAs(cmd=cmd, pwd=pwd, **parsed.__dict__)
    elif cmd.endswith('mv') or cmd.endswith('ln') or cmd.endswith('cp') or cmd.endswith('install'):
        return _parse_alt_name(args, cmd, pwd)

    return None
