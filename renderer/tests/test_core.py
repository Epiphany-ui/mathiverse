import sys
import unittest
from unittest.mock import patch

from renderer.core import compute_render_key, is_render_cacheable, validate_code


VALID_CODE = """from manim import *
class UnitCircle(Scene):
    def construct(self):
        self.play(Create(Circle()))
"""


class RendererCoreTests(unittest.TestCase):
    def test_render_key_is_stable_and_environment_sensitive(self):
        first = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        second = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        changed = compute_render_key(VALID_CODE, "-qh", "mp4", "0.19.0")
        self.assertEqual(first, second)
        self.assertNotEqual(first, changed)

    def test_render_key_normalizes_newlines_and_ignores_process_context(self):
        windows = compute_render_key(VALID_CODE.replace("\n", "\r\n"), "-ql", "mp4", "0.19.0")
        unix = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        self.assertEqual(windows, unix)

    def test_render_key_includes_python_major_minor(self):
        current = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        fake_version = type("Version", (), {
            "major": sys.version_info.major,
            "minor": sys.version_info.minor + 1,
        })()
        with patch("renderer.core.sys.version_info", fake_version):
            changed = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        self.assertNotEqual(current, changed)

    def test_render_key_includes_cache_schema_version(self):
        current = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        with patch("renderer.core.RENDERER_CACHE_SCHEMA_VERSION", "future-schema"):
            changed = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        self.assertNotEqual(current, changed)

    def test_random_imports_bypass_shared_render_cache(self):
        self.assertTrue(is_render_cacheable(VALID_CODE))
        self.assertFalse(is_render_cacheable("import random\n" + VALID_CODE))
        self.assertFalse(is_render_cacheable("import numpy as np\n" + VALID_CODE))

    def test_validation_discovers_scene_and_rejects_process_access(self):
        valid = validate_code(VALID_CODE)
        blocked = validate_code("import subprocess\nclass Bad(Scene):\n    pass")
        self.assertTrue(valid.valid)
        self.assertEqual(valid.scene_name, "UnitCircle")
        self.assertFalse(blocked.valid)
        self.assertEqual(blocked.issues[0].code, "security")

    def test_syntax_error_has_a_line_number(self):
        result = validate_code("from manim import *\nclass Broken(Scene)\n    pass")
        self.assertFalse(result.valid)
        self.assertEqual(result.issues[0].line, 2)

    def test_validation_accepts_supported_scene_variants_and_safe_imports(self):
        code = """from manim import MovingCameraScene
import numpy as np
from math import pi
class CameraDemo(MovingCameraScene):
    pass
"""
        result = validate_code(code)
        self.assertTrue(result.valid)
        self.assertEqual(result.scene_name, "CameraDemo")

    def test_validation_rejects_indirect_dangerous_calls(self):
        for code in (
            "from pathlib import Path\nclass Bad(Scene):\n    pass",
            "from manim import *\nclass Bad(Scene):\n    def construct(self):\n        open('x')",
            "from manim import *\nclass Bad(Scene):\n    def construct(self):\n        __import__('os')",
        ):
            with self.subTest(code=code):
                result = validate_code(code)
                self.assertFalse(result.valid)
                self.assertEqual(result.issues[0].code, "security")

    def test_validation_reports_missing_scene(self):
        result = validate_code("from manim import *\nx = 1")
        self.assertFalse(result.valid)
        self.assertEqual(result.issues[0].code, "scene")


if __name__ == "__main__":
    unittest.main()
