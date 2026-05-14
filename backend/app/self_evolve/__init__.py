"""Self-evolution package — let the LLM modify the project's own config.toml.

Composition:

* :class:`SelfEvolveLlm` — asks an LLM to propose minimal TOML changes given
  the current config + a natural-language request.
* :class:`ConfigPatcher` — reads, parses (preserving comments + layout), and
  writes back a target ``config.toml`` after applying a list of dotted-path
  updates.
* :class:`SelfEvolveService` — orchestrates the two; streams structured
  events for live UI display.

The package is standalone: it depends only on the LLM client of choice
(OpenAI here) and a target directory. It does not import anything from the
routes or framework layers.
"""

from app.self_evolve.llm import SelfEvolveLlm
from app.self_evolve.patcher import ConfigPatcher, PatchError
from app.self_evolve.schemas import (
    AppliedChange,
    Availability,
    ChangeProposal,
    ConfigChange,
)
from app.self_evolve.service import SelfEvolveService

__all__ = [
    "AppliedChange",
    "Availability",
    "ChangeProposal",
    "ConfigChange",
    "ConfigPatcher",
    "PatchError",
    "SelfEvolveLlm",
    "SelfEvolveService",
]
