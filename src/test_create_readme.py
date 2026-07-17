import contextlib
import importlib.util
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import unquote


SHADER_DIR = Path(__file__).resolve().parents[1] / "dist" / "shaders"
SCRIPT = SHADER_DIR / "create_readme.py"
spec = importlib.util.spec_from_file_location("create_readme", SCRIPT)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def render(folder):
    stderr = io.StringIO()
    with contextlib.redirect_stderr(stderr):
        credits = generator.read_meta_files(folder)
    output = io.StringIO()
    handle = mock.MagicMock()
    handle.__enter__.return_value = output
    with mock.patch("builtins.open", return_value=handle):
        generator.write_readme(credits)
    return output.getvalue(), stderr.getvalue()


def preview_links(markdown):
    return re.findall(r"^!\[ \]\((.+)\)$", markdown, re.MULTILINE)


class CreateReadmeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.shaders = self.root / "dist" / "shaders"
        self.previews = self.root / "dist" / "images" / "preview"
        self.shaders.mkdir(parents=True)
        self.previews.mkdir(parents=True)

    def add_shader(self, filename, metadata=None, preview=True, source=True):
        data = {
            "shaderName": filename.removesuffix(".frag"),
            "author": "Test Author",
            "modifiedBy": "Test Modifier",
            "url": "https://www.shadertoy.com/view/fXc3zB",
            "license": "MIT",
            "licenseURL": "https://opensource.org/licenses/MIT",
        }
        data.update(metadata or {})
        (self.shaders / f"{filename}.meta").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        if source:
            (self.shaders / filename).write_text("void main() {}", encoding="utf-8")
        if preview:
            (self.previews / f"{filename}.png").touch()

    def test_excludes_hidden_buffers_and_hidden_main_shaders(self):
        self.add_shader("Main.frag", {"buffers": [{"shaderName": "MainBufferA.frag"}]})
        self.add_shader("Standalone.frag")
        for filename in ["MainBufferA.frag", "BufferB.frag", "BufferC.frag", "BufferD.frag", "FinalShader.frag"]:
            self.add_shader(filename, {"hidden": True}, preview=False)
        output, warnings = render(self.shaders)
        self.assertEqual(re.findall(r"^## (.+)$", output, re.MULTILINE), ["Main", "Standalone"])
        self.assertEqual(warnings, "")

    def test_excludes_referenced_buffers_even_without_hidden_flag(self):
        self.add_shader("Main.frag", {"buffers": [{"shaderName": "HistoryPass.frag"}]})
        self.add_shader("HistoryPass.frag")
        self.add_shader("BufferArt.frag", {"hidden": False})
        output, _ = render(self.shaders)
        self.assertIn("## Main\n", output)
        self.assertIn("## BufferArt\n", output)
        self.assertNotIn("HistoryPass", output)

    def test_hidden_only_metadata_does_not_create_none_entry(self):
        self.add_shader("Main.frag")
        (self.shaders / "BufferA.frag").touch()
        (self.shaders / "BufferA.frag.meta").write_text('{"hidden": true}', encoding="utf-8")
        output, _ = render(self.shaders)
        self.assertNotIn("None", output)
        self.assertEqual(output.count("\n## "), 1)

    def test_keeps_distinct_main_files_with_duplicate_display_names(self):
        for filename in ["Shaderwave.frag", "Shaderwave_vid.frag", "Shaderwave_vid_c-base.frag"]:
            self.add_shader(filename, {"shaderName": "Shaderwave", "author": filename})
        output, _ = render(self.shaders)
        self.assertEqual(output.count("## Shaderwave\n"), 3)
        for filename in ["Shaderwave.frag", "Shaderwave_vid.frag", "Shaderwave_vid_c-base.frag"]:
            self.assertIn(f"Author: {filename}\n", output)
            self.assertIn(f"../images/preview/{filename}.png", output)

    def test_missing_preview_preserves_credits_without_broken_image(self):
        self.add_shader("NoPreview.frag", preview=False)
        output, warnings = render(self.shaders)
        self.assertIn("## NoPreview\n", output)
        self.assertIn("Author: Test Author\n", output)
        self.assertEqual(preview_links(output), [])
        self.assertIn("NoPreview.frag.png", warnings)

    def test_empty_fields_are_omitted_and_missing_name_uses_filename(self):
        self.add_shader("Fallback.frag", {"shaderName": None, "modifiedBy": None, "url": "", "licenseURL": None})
        output, _ = render(self.shaders)
        self.assertIn("## Fallback\n", output)
        self.assertNotIn("None", output)
        for label in ["Modified by:", "Shader URL:", "License URL:"]:
            self.assertNotIn(label, output)
        self.assertIn("License: MIT\n", output)

    def test_ignores_non_shader_and_orphan_metadata(self):
        self.add_shader("Main.frag")
        self.add_shader("Orphan.frag", source=False)
        (self.shaders / "config.meta").write_text('{"shaderName": "Config"}', encoding="utf-8")
        output, _ = render(self.shaders)
        self.assertEqual(re.findall(r"^## (.+)$", output, re.MULTILINE), ["Main"])

    def test_sorts_by_name_then_filename_independent_of_directory_order(self):
        self.add_shader("z.frag", {"shaderName": "alpha"})
        self.add_shader("b.frag", {"shaderName": "Beta"})
        self.add_shader("a.frag", {"shaderName": "alpha"})
        filenames = [path.name for path in self.shaders.iterdir()]
        with mock.patch.object(generator.os, "listdir", return_value=filenames):
            first, _ = render(self.shaders)
        with mock.patch.object(generator.os, "listdir", return_value=list(reversed(filenames))):
            second, _ = render(self.shaders)
        self.assertEqual(first, second)
        self.assertEqual(preview_links(first), [f"../images/preview/{name}.frag.png" for name in ["a", "z", "b"]])

    def test_preserves_unicode_credits_and_escapes_preview_filenames(self):
        self.add_shader("[Test] café (1).frag", {"shaderName": "échappatoire", "author": "é Author "})
        output, _ = render(self.shaders)
        self.assertIn("## échappatoire\n", output)
        self.assertIn("Author: é Author\n", output)
        links = preview_links(output)
        self.assertEqual(len(links), 1)
        self.assertNotIn(" ", links[0])
        self.assertNotIn("(", links[0])
        self.assertTrue((self.shaders / unquote(links[0])).is_file())

    def test_cli_targets_script_directory_and_is_repeatable(self):
        self.add_shader("Main.frag")
        script = self.shaders / "create_readme.py"
        shutil.copyfile(SCRIPT, script)
        root_readme = self.root / "README.md"
        root_readme.write_text("Keep root README\n", encoding="utf-8")
        for cwd in [self.root, self.shaders]:
            subprocess.run([sys.executable, "-B", str(script)], cwd=cwd, check=True, capture_output=True, text=True)
            self.assertEqual(root_readme.read_text(encoding="utf-8"), "Keep root README\n")
            self.assertTrue((self.shaders / "README.md").is_file())
        first = (self.shaders / "README.md").read_bytes()
        subprocess.run([sys.executable, "-B", str(script)], cwd=self.shaders, check=True, capture_output=True)
        self.assertEqual(first, (self.shaders / "README.md").read_bytes())
        output, _ = render(self.shaders)
        self.assertEqual(first, output.encode("utf-8"))

    def test_explicit_output_path(self):
        self.add_shader("Main.frag")
        output_path = self.shaders / "test-output.md"
        generator.write_readme(generator.read_meta_files(self.shaders), output_path)
        expected, _ = render(self.shaders)
        self.assertEqual(output_path.read_text(encoding="utf-8"), expected)


class RepositoryCreditsTests(unittest.TestCase):
    def test_readme_matches_generator(self):
        output, _ = render(SHADER_DIR)
        self.assertEqual((SHADER_DIR / "README.md").read_text(encoding="utf-8").strip(), output.strip())

    def test_repository_main_coverage_and_preview_references(self):
        metadata = {
            path.name.removesuffix(".meta"): json.loads(path.read_text(encoding="utf-8"))
            for path in SHADER_DIR.glob("*.frag.meta")
            if path.with_suffix("").is_file()
        }
        buffer_files = {buffer["shaderName"] for data in metadata.values() for buffer in data.get("buffers", [])}
        expected = {name: data for name, data in metadata.items() if data.get("hidden") is not True and name not in buffer_files}
        output, _ = render(SHADER_DIR)
        expected_names = sorted((data.get("shaderName") or filename.removesuffix(".frag")).strip() for filename, data in expected.items())
        self.assertEqual(sorted(re.findall(r"^## (.+)$", output, re.MULTILINE)), expected_names)
        links = preview_links(output)
        for link in links:
            self.assertTrue((SHADER_DIR / unquote(link)).is_file(), link)
        expected_previews = {
            filename + ".png" for filename in expected
            if (SHADER_DIR.parent / "images" / "preview" / (filename + ".png")).is_file()
        }
        self.assertEqual({Path(unquote(link)).name for link in links}, expected_previews)
        self.assertEqual(len(links), len(expected_previews))
        for excluded in set(metadata) - set(expected):
            self.assertNotIn(excluded + ".png", {Path(unquote(link)).name for link in links})


if __name__ == "__main__":
    unittest.main()
