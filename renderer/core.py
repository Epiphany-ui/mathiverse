"""Pure validation and cache-key primitives for the Manim renderer.

The AST checks reduce accidental and obvious unsafe access. They are deliberately
kept even when the renderer runs in isolation, but they are not a security
boundary: production rendering still needs a sandbox with resource and network
limits.
"""

from __future__ import annotations

import ast
import hashlib
import json
import sys
from dataclasses import dataclass, field


ALLOWED_IMPORT_ROOTS = frozenset({"manim", "numpy", "math", "random", "statistics"})
RENDERER_CACHE_SCHEMA_VERSION = "1"
BLOCKED_ROOTS = frozenset(
    {
        "os",
        "sys",
        "subprocess",
        "socket",
        "pathlib",
        "shutil",
        "requests",
        "urllib",
        "open",
        "eval",
        "exec",
        "compile",
        "__import__",
    }
)


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    code: str
    message: str
    line: int | None = None
    column: int | None = None


@dataclass(frozen=True, slots=True)
class ValidationResult:
    valid: bool
    scene_name: str | None = None
    issues: list[ValidationIssue] = field(default_factory=list)


def compute_render_key(
    code: str,
    quality: str,
    fmt: str,
    manim_version: str,
) -> str:
    """Return a stable key for every input that can affect rendered bytes."""
    normalized = code.replace("\r\n", "\n").strip() + "\n"
    payload = json.dumps(
        {
            "cache_schema": RENDERER_CACHE_SCHEMA_VERSION,
            "code": normalized,
            "quality": quality,
            "format": fmt,
            "manim_version": manim_version,
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def is_render_cacheable(code: str) -> bool:
    """Conservatively avoid sharing cached output for potentially random scenes."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return False

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.name.split(".", 1)[0] in {"random", "numpy"} for alias in node.names):
                return False
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".", 1)[0] in {"random", "numpy"}:
                return False
        elif isinstance(node, ast.Name) and node.id in {"random", "numpy", "np"}:
            return False
    return True


def _root_name(node: ast.expr) -> str | None:
    while isinstance(node, ast.Attribute):
        node = node.value
    return node.id if isinstance(node, ast.Name) else None


def _base_name(node: ast.expr) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _issue(
    code: str,
    message: str,
    node: ast.AST | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        code=code,
        message=message,
        line=getattr(node, "lineno", None),
        column=(getattr(node, "col_offset", -1) + 1) if hasattr(node, "col_offset") else None,
    )


def validate_code(code: str) -> ValidationResult:
    """Statically validate code and discover its first Manim Scene subclass."""
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return ValidationResult(
            valid=False,
            issues=[
                ValidationIssue(
                    code="syntax",
                    message=exc.msg,
                    line=exc.lineno,
                    column=exc.offset,
                )
            ],
        )

    issues: list[ValidationIssue] = []
    scene_name: str | None = None

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root not in ALLOWED_IMPORT_ROOTS:
                    issues.append(
                        _issue("security", f"Import '{root}' is not allowed.", node)
                    )
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".", 1)[0]
            if node.level or root not in ALLOWED_IMPORT_ROOTS:
                label = root or "relative import"
                issues.append(
                    _issue("security", f"Import '{label}' is not allowed.", node)
                )
        elif isinstance(node, ast.Call):
            root = _root_name(node.func)
            if root in BLOCKED_ROOTS:
                issues.append(
                    _issue("security", f"Call to '{root}' is not allowed.", node)
                )
        elif isinstance(node, ast.ClassDef) and scene_name is None:
            if any((_base_name(base) or "").endswith("Scene") for base in node.bases):
                scene_name = node.name

    if issues:
        issues.sort(key=lambda item: (item.line or 0, item.column or 0, item.message))
        return ValidationResult(valid=False, scene_name=scene_name, issues=issues)
    if scene_name is None:
        return ValidationResult(
            valid=False,
            issues=[
                ValidationIssue(
                    code="scene",
                    message="No Manim Scene subclass was found.",
                )
            ],
        )
    return ValidationResult(valid=True, scene_name=scene_name)
