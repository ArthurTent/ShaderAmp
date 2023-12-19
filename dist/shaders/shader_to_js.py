# The MIT License (MIT)
# Copyright © 2023 Arthur Tent
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the “Software”), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.

import shlex
import sys
import os


def read_file(file_name: str) -> str:
    f = open(file_name, "r")
    shader_lines = f.readlines()
    shader_name = file_name.split(".")[0]
    js_string_shader = "// This file use the same license as the original shader.\n"
    js_string_shader += "// DO NOT MODIFY THIS FILE!\n"
    js_string_shader += "// Modify the .frag file instead and use:\n"
    js_string_shader += "// \"python3 shader_to_js.py\" to compile your changes !\n\n"
    js_string_shader += f"var {shader_name}_frag =\n"
    for line in shader_lines:
        js_string_shader += '"' + line.strip().replace('"', '\\"') + '\\n"+\n'
    js_string_shader = js_string_shader[:-2]
    return js_string_shader


def all_files() -> None:
    path = "."
    files = [
        f
        for f in os.listdir(path)
        if os.path.isfile(os.path.join(path, f)) and os.path.splitext(f)[1] == ".frag"
    ]
    for shader_file in files:
        js_code = read_file(shader_file)
        f = open(shader_file + ".js", "w")
        f.write(js_code)
        f.close()
    return


def main() -> int:
    if len(sys.argv) > 1:
        if len(sys.argv) > 2:
            print(f"Usage: shader_to_js.py [optional <FILENAME>]")
            print(f"eg: python3 shader_to_js.py")
            print(f"or python3 shader_to_js.py shader_name.frag")
            return 0
        read_file(sys.argv[1])
        print(f"Args: {sys.argv[1]}")
    else:
        all_files()
    return 0


if __name__ == "__main__":
    sys.exit(main())
