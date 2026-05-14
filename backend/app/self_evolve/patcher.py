"""Read, mutate, and write a TOML config — preserving comments and layout.

Uses ``tomlkit`` for round-trip fidelity: formatting, comments, blank lines,
and divider headers in ``config.toml`` survive a patch. Only the values
referenced by the supplied dotted paths change.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import tomlkit

from app.self_evolve.schemas import AppliedChange, ConfigChange


class PatchError(RuntimeError):
    """Raised when a dotted path can't be resolved or the file can't be written."""


class ConfigPatcher:
    """Round-trip patcher for a single TOML file."""

    def __init__(self, config_path: Path) -> None:
        self._config_path = config_path

    @property
    def config_path(self) -> Path:
        return self._config_path

    # ─── Reads ────────────────────────────────────────────────────────────────

    def read_text(self) -> str:
        if not self._config_path.is_file():
            raise PatchError(f"config file not found: {self._config_path}")
        return self._config_path.read_text(encoding="utf-8")

    # ─── Writes ───────────────────────────────────────────────────────────────

    def apply(self, changes: list[ConfigChange]) -> list[AppliedChange]:
        """Apply all changes — either every change lands and the file is
        rewritten, or nothing is written and a :class:`PatchError` is raised.

        The original document is parsed once, mutated in memory, and dumped
        back as a whole — so comments, blank lines, and key ordering are
        preserved.
        """
        text = self.read_text()
        doc = tomlkit.parse(text)

        applied: list[AppliedChange] = []
        for change in changes:
            old = _set_dotted(doc, change.path, change.value)
            applied.append(
                AppliedChange(
                    path=change.path,
                    old_value=old,
                    new_value=change.value,
                ),
            )

        try:
            self._config_path.write_text(tomlkit.dumps(doc), encoding="utf-8")
        except OSError as e:
            raise PatchError(f"failed to write {self._config_path}: {e}") from e

        return applied


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _unwrap(value: Any) -> Any:
    """Convert a tomlkit Item to a plain Python value (or pass through)."""
    if hasattr(value, "unwrap"):
        return value.unwrap()
    return value


def _has_key(node: Any, key: str) -> bool:
    try:
        return key in node
    except TypeError:
        return False


def _set_dotted(doc: Any, path: str, new_value: Any) -> Any:
    """Walk a dotted path inside a tomlkit document and replace the leaf.

    Returns the previous value as a plain Python value. Raises
    :class:`PatchError` if any segment is missing.
    """
    if not path:
        raise PatchError("empty path")

    parts = path.split(".")
    *parents, leaf = parts

    node: Any = doc
    walked: list[str] = []
    for segment in parents:
        walked.append(segment)
        if not _has_key(node, segment):
            raise PatchError(f"path not found: {'.'.join(walked)}")
        node = node[segment]

    if not _has_key(node, leaf):
        raise PatchError(f"path not found: {path}")

    old = _unwrap(node[leaf])
    node[leaf] = new_value
    return old
