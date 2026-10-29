import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parent.parent / "dist" / "shaders" / "shader_to_js.py"


class ShaderToJsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="shaderamp paths ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.shaders = self.root / "shader directory"
        self.caller = self.root / "other directory"
        self.shaders.mkdir()
        self.caller.mkdir()
        self.script = self.shaders / SCRIPT.name
        shutil.copyfile(SCRIPT, self.script)
        (self.shaders / "Sample.frag").write_text("void main() {}\n", encoding="utf-8")
        spec = importlib.util.spec_from_file_location("shader_to_js", self.script)
        self.generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.generator)

    def test_absolute_input_uses_filename_stem_for_identifier(self):
        result = self.generator.read_file(str(self.shaders / "Sample.frag"))
        self.assertIn("var Sample_frag =", result)
        self.assertNotIn(str(self.shaders), result)

    def test_default_cli_uses_script_directory_from_any_working_directory(self):
        (self.caller / "Unrelated.frag").write_text("unrelated\n", encoding="utf-8")
        for cwd in [self.caller, self.root, self.shaders]:
            subprocess.run([sys.executable, "-B", str(self.script)], cwd=cwd, check=True, capture_output=True, text=True)
            output = self.shaders / "Sample.frag.js"
            self.assertTrue(output.is_file())
            self.assertIn("var Sample_frag =", output.read_text(encoding="utf-8"))
            self.assertFalse((self.caller / "Unrelated.frag.js").exists())

    def test_explicit_relative_input_is_resolved_from_caller(self):
        (self.caller / "Explicit.frag").write_text("explicit\n", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, "-B", str(self.script), "Explicit.frag"],
            cwd=self.caller, check=True, capture_output=True, text=True,
        )
        self.assertIn("Args: Explicit.frag", result.stdout)


if __name__ == "__main__":
    unittest.main()
