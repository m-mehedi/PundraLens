"""LLM provider + model catalogue.

The catalogue lives in code so a new model is added by editing a single list
and the API can expose it — that way several models can be pointed at the same
notice and their outputs compared side by side.

Two providers are supported:

- ``groq``   — OpenAI-compatible fast inference (default).
- ``gemini`` — Google Gemini, kept for when its quota is available again.

Only the API keys live in the environment; the model list does not.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Set, Type

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Prefix used to run a provider model that is not in the catalogue yet,
# e.g. "custom:groq:moonshotai/kimi-k2-instruct".
CUSTOM_PREFIX = "custom:"

# Requests time out after this many seconds (extraction can be slow).
REQUEST_TIMEOUT = 120

# How many times a structured-output call is retried with the validation
# error fed back to the model.
DEFAULT_ATTEMPTS = 2

# How long the provider model list is cached before it is fetched again.
MODEL_LIST_TTL = 300


class UnknownModelError(ValueError):
    """Raised when a requested model key is not in the catalogue."""


@dataclass(frozen=True)
class ModelSpec:
    """A single entry of the model catalogue."""

    key: str
    """Public identifier used by the API (e.g. ``groq-qwen3.8-27b``)."""

    label: str
    """Human readable name shown in the UI."""

    provider: str
    """``groq`` or ``gemini``."""

    model_id: str
    """Provider side model id (e.g. ``qwen/qwen3.8-27b``)."""

    temperature: float = 0.6
    max_tokens: int = 8192
    strict_json: bool = False
    """Whether the provider guarantees the output matches the JSON schema."""

    vision: bool = False
    """Whether the model accepts image input."""

    reasoning_effort: Optional[str] = None
    reasoning_format: Optional[str] = None
    notes: str = ""

    def to_dict(self, available: bool) -> Dict[str, Any]:
        """Serialize for the API."""
        return {
            "key": self.key,
            "label": self.label,
            "provider": self.provider,
            "provider_model_id": self.model_id,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "strict_json": self.strict_json,
            "vision": self.vision,
            "notes": self.notes,
            "available": available,
        }


MODEL_CATALOG: Sequence[ModelSpec] = (
    ModelSpec(
        key="groq-qwen3.8-27b",
        label="Qwen3.8 27B",
        provider="groq",
        model_id="qwen/qwen3.8-27b",
        temperature=0.6,
        strict_json=False,
        vision=True,
        reasoning_effort="none",
        reasoning_format="hidden",
        notes="Best Bengali of the Groq lineup; preview model.",
    ),
    ModelSpec(
        key="groq-gpt-oss-120b",
        label="GPT-OSS 120B",
        provider="groq",
        model_id="openai/gpt-oss-120b",
        temperature=0.6,
        strict_json=True,
        vision=False,
        reasoning_effort="medium",
        reasoning_format="hidden",
        notes="Guaranteed schema adherence (constrained decoding).",
    ),
    ModelSpec(
        key="groq-gpt-oss-20b",
        label="GPT-OSS 20B",
        provider="groq",
        model_id="openai/gpt-oss-20b",
        temperature=0.6,
        strict_json=True,
        vision=False,
        reasoning_effort="medium",
        reasoning_format="hidden",
        notes="Cheaper GPT-OSS, same schema guarantees.",
    ),
    ModelSpec(
        key="groq-llama-3.3-70b",
        label="Llama 3.3 70B",
        provider="groq",
        model_id="llama-3.3-70b-versatile",
        temperature=0.6,
        strict_json=False,
        vision=False,
        notes="JSON mode / tool calling only. May need to be enabled for your key.",
    ),
    ModelSpec(
        key="gemini-3.8-flash",
        label="Gemini 3.8 Flash",
        provider="gemini",
        model_id="gemini-3.8-flash",
        temperature=0.1,
        strict_json=True,
        vision=True,
        notes="Free tier quota is 20 requests/day.",
    ),
)

DEFAULT_MODEL_KEY = "groq-qwen3.8-27b"

# Provider -> environment variable holding its API key.
_PROVIDER_KEY_ENV = {
    "groq": "GROQ_API_KEY",
    "gemini": "GOOGLE_API_KEY",
}

# Cached chat clients, keyed by (provider, model_id, temperature, max_tokens).
_clients: Dict[tuple, Any] = {}

# Cached provider model lists: provider -> (fetched_at, model_ids or None).
_model_lists: Dict[str, tuple] = {}


def provider_key_env(provider: str) -> Optional[str]:
    """Name of the environment variable holding *provider*'s API key."""
    return _PROVIDER_KEY_ENV.get(provider)


def provider_model_ids(provider: str) -> Optional[Set[str]]:
    """Model ids the provider account can use.

    Returns ``None`` when the list could not be fetched (no key, network
    problem) — callers then fall back to "assume available".
    """
    cached = _model_lists.get(provider)
    if cached and (time.monotonic() - cached[0]) < MODEL_LIST_TTL:
        return cached[1]

    ids: Optional[Set[str]] = None
    if provider == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if api_key:
            try:
                import httpx

                response = httpx.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=5.0,
                )
                response.raise_for_status()
                ids = {m["id"] for m in response.json().get("data", [])}
            except Exception as e:  # noqa: BLE001 - availability is best effort
                logger.warning("Could not list Groq models: %s", e)

    _model_lists[provider] = (time.monotonic(), ids)
    return ids


def is_available(spec: ModelSpec) -> bool:
    """Whether this deployment can actually run *spec*."""
    env_var = provider_key_env(spec.provider)
    if not env_var or not os.environ.get(env_var):
        return False
    ids = provider_model_ids(spec.provider)
    if ids is None:
        return True
    return spec.model_id in ids


def list_models() -> List[Dict[str, Any]]:
    """Every catalogue entry, serialized for the API."""
    return [spec.to_dict(is_available(spec)) for spec in MODEL_CATALOG]


def default_model() -> ModelSpec:
    """The model used when a request does not ask for one."""
    return get_model(None)


def get_model(key: Optional[str]) -> ModelSpec:
    """Resolve a catalogue key (or a ``custom:<provider>:<model_id>`` string).

    ``None`` or an empty key selects the default model.
    """
    if not key or not key.strip():
        return _model_by_key(DEFAULT_MODEL_KEY)

    key = key.strip()

    if key.lower().startswith(CUSTOM_PREFIX):
        return _custom_model(key)

    return _model_by_key(key)


def _model_by_key(key: str) -> ModelSpec:
    for spec in MODEL_CATALOG:
        if spec.key == key:
            return spec
    valid = ", ".join(spec.key for spec in MODEL_CATALOG)
    raise UnknownModelError(f"Unknown model '{key}'. Available models: {valid}")


def _custom_model(key: str) -> ModelSpec:
    """Build an ad-hoc spec for a model that is not in the catalogue."""
    remainder = key[len(CUSTOM_PREFIX):]
    provider, separator, model_id = remainder.partition(":")
    if not separator or not provider or not model_id:
        raise UnknownModelError(
            f"Invalid custom model '{key}'. Expected "
            f"'{CUSTOM_PREFIX}<provider>:<model_id>' (e.g. "
            f"'{CUSTOM_PREFIX}groq:llama-3.3-70b-versatile')."
        )
    if provider not in _PROVIDER_KEY_ENV:
        valid = ", ".join(sorted(_PROVIDER_KEY_ENV))
        raise UnknownModelError(
            f"Unknown provider '{provider}' in '{key}'. Available providers: {valid}"
        )
    return ModelSpec(
        key=key,
        label=model_id,
        provider=provider,
        model_id=model_id,
        temperature=0.6,
        notes="Ad-hoc model, not part of the catalogue.",
    )


def get_chat_client(spec: ModelSpec) -> Any:
    """Return a cached chat client for *spec*."""
    cache_key = (spec.provider, spec.model_id, spec.temperature, spec.max_tokens)
    client = _clients.get(cache_key)
    if client is not None:
        return client

    if spec.provider == "groq":
        client = _groq_client(spec)
    elif spec.provider == "gemini":
        client = _gemini_client(spec)
    else:  # pragma: no cover - guarded by get_model()
        raise UnknownModelError(f"Unknown provider '{spec.provider}'")

    _clients[cache_key] = client
    return client


def _groq_client(spec: ModelSpec) -> Any:
    from langchain_groq import ChatGroq

    api_key = os.environ.get(_PROVIDER_KEY_ENV["groq"] or "")
    if not api_key:
        raise EnvironmentError(
            "GROQ_API_KEY environment variable is not set. "
            "Get one at https://console.groq.com/keys"
        )

    # Groq defaults `max_completion_tokens` to 1024, which is far too small
    # for a notice JSON with two summaries.
    client = ChatGroq(
        model=spec.model_id,
        api_key=api_key,
        temperature=spec.temperature,
        timeout=REQUEST_TIMEOUT,
        max_retries=3,
        reasoning_effort=spec.reasoning_effort,
        reasoning_format=spec.reasoning_format,
        model_kwargs={"max_completion_tokens": spec.max_tokens},
    )
    logger.info("Groq client initialized (%s)", spec.model_id)
    return client


def _gemini_client(spec: ModelSpec) -> Any:
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = os.environ.get(_PROVIDER_KEY_ENV["gemini"] or "")
    if not api_key:
        raise EnvironmentError(
            "GOOGLE_API_KEY environment variable is not set. "
            "Get one at https://aistudio.google.com/apikey"
        )

    client = ChatGoogleGenerativeAI(
        model=spec.model_id,
        api_key=api_key,
        temperature=spec.temperature,
    )
    logger.info("Google Gemini client initialized (%s)", spec.model_id)
    return client


def groq_json_schema(schema: Type[BaseModel]) -> Dict[str, Any]:
    """JSON schema shaped for Groq's Structured Outputs API.

    Every property becomes required, objects are closed
    (``additionalProperties: false``) and ``default`` keys are dropped —
    Groq's own documentation recommends following the strict shape even in
    best-effort mode.
    """
    from langchain_core.utils.function_calling import convert_to_json_schema

    return _sanitize(convert_to_json_schema(schema))


def _sanitize(node: Any) -> Any:
    if isinstance(node, dict):
        node.pop("default", None)
        for value in node.values():
            _sanitize(value)
        if node.get("type") == "object" and isinstance(node.get("properties"), dict):
            node["required"] = list(node["properties"].keys())
            node["additionalProperties"] = False
    elif isinstance(node, list):
        for item in node:
            _sanitize(item)
    return node


def with_structured(client: Any, spec: ModelSpec, schema: Type[BaseModel]) -> Any:
    """Bind *schema* to *client* using the provider's structured-output mode."""
    if spec.provider == "groq":
        # A dict schema is used on purpose: it carries the sanitized shape
        # (all fields required, closed objects, no defaults).
        return client.with_structured_output(
            groq_json_schema(schema),
            method="json_schema",
            strict=spec.strict_json,
        )
    return client.with_structured_output(schema, method="json_schema")


def invoke_structured(
    client: Any,
    spec: ModelSpec,
    schema: Type[BaseModel],
    messages: List[Any],
    attempts: int = DEFAULT_ATTEMPTS,
) -> Dict[str, Any]:
    """Run a structured-output call and return a dict valid against *schema*.

    A parse or validation failure is fed back to the model once before giving
    up, which covers best-effort JSON modes where the shape is not enforced.
    """
    runner = with_structured(client, spec, schema)
    conversation = list(messages)
    last_error: Optional[Exception] = None

    for attempt in range(max(1, attempts)):
        try:
            result = runner.invoke(conversation)
            data = result if isinstance(result, dict) else result.model_dump()
            schema(**data)
            return data
        except Exception as e:  # noqa: BLE001 - retried below
            last_error = e
            if attempt + 1 >= max(1, attempts):
                break
            logger.warning(
                "Structured output invalid for %s (attempt %s/%s): %s",
                spec.key,
                attempt + 1,
                attempts,
                e,
            )
            conversation = list(messages) + [
                {
                    "role": "user",
                    "content": (
                        "Your previous response could not be parsed "
                        f"({e}). Reply with ONLY valid JSON matching the "
                        "requested schema — no prose, no markdown fences."
                    ),
                }
            ]

    raise last_error if last_error else RuntimeError("Structured output failed")


def describe_default() -> Dict[str, Any]:
    """Summary of the default model, for the health endpoint."""
    spec = default_model()
    return {
        "provider": spec.provider,
        "model": spec.model_id,
        "key": spec.key,
        "label": spec.label,
        "available": is_available(spec),
    }
