"""Inspect/apply Google OAuth for LOAN DEV or STAGING; never log secrets.

Run from app/. Default is read-only. --apply requires a downloaded Google Web
client JSON kept under the git/EAS-ignored .local directory.
"""
import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

TARGETS = {
    "development": ("rwfmqthrpbkizcofullh", "shared-loan-dev", 8082),
    "staging": ("kircmwdkcdcozckrwfid", "shared-loan-staging", 8083),
}
CLIENT_ID = re.compile(r"[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com")


def credential():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if token:
        if not re.fullmatch(r"sbp_[A-Za-z0-9_-]+", token):
            raise RuntimeError("Invalid management credential format")
        return token
    if os.name != "nt":
        raise RuntimeError("Set SUPABASE_ACCESS_TOKEN securely before running")

    class Credential(ctypes.Structure):
        _fields_ = [
            ("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
            ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
            ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
            ("CredentialBlob", ctypes.POINTER(ctypes.c_byte)),
            ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
            ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
            ("UserName", wintypes.LPWSTR),
        ]

    api = ctypes.WinDLL("Advapi32.dll")
    api.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                            ctypes.POINTER(ctypes.POINTER(Credential))]
    api.CredReadW.restype = wintypes.BOOL
    api.CredFree.argtypes = [ctypes.c_void_p]
    for target in ["Supabase CLI:supabase", "Supabase CLI:access-token"]:
        pointer = ctypes.POINTER(Credential)()
        if api.CredReadW(target, 1, 0, ctypes.byref(pointer)):
            try:
                raw = ctypes.string_at(pointer.contents.CredentialBlob,
                                       pointer.contents.CredentialBlobSize)
                for encoding in ["utf-8", "utf-16-le"]:
                    try:
                        token = raw.decode(encoding).strip("\x00")
                        if re.fullmatch(r"sbp_[A-Za-z0-9_-]+", token):
                            return token
                    except UnicodeError:
                        pass
            finally:
                api.CredFree(pointer)
    raise RuntimeError("Sign in with Supabase CLI first")


def request(token, endpoint, method="GET", body=None):
    req = urllib.request.Request(
        "https://api.supabase.com/v1/" + endpoint, method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        # Response bodies can echo secret configuration; deliberately omit them.
        raise RuntimeError("Management API HTTP " + str(error.code)) from None


def callbacks(environment, port):
    return [f"http://127.0.0.1:{port}/auth/callback",
            f"http://localhost:{port}/auth/callback", f"loan-{environment}://auth/callback"]


def validate_client(file, ref):
    file = Path(file).resolve()
    if not file.is_relative_to(Path(".local").resolve()) or file.suffix != ".json":
        raise RuntimeError("Keep the downloaded client JSON under app/.local/")
    client = json.loads(file.read_text(encoding="utf-8-sig")).get("web", {})
    if not CLIENT_ID.fullmatch(client.get("client_id", "")) or not client.get("client_secret"):
        raise RuntimeError("A valid Google Web application client JSON is required")
    if f"https://{ref}.supabase.co/auth/v1/callback" not in client.get("redirect_uris", []):
        raise RuntimeError("Add this environment's Supabase callback in Google Console, then download JSON again")
    return client


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=TARGETS)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--client-json")
    args = parser.parse_args()
    if args.apply != bool(args.client_json):
        raise RuntimeError("Use --apply and --client-json together, or neither to inspect")
    ref, name, port = TARGETS[args.environment]
    client = validate_client(args.client_json, ref) if args.apply else None
    token = credential()
    inventory = request(token, "projects")
    project = next((p for p in inventory if p["id"] == ref), None)
    if (not project or project["name"] != name
            or project["organization_id"] != "tkwgdaopuggxnipfekmw"
            or project["status"] != "ACTIVE_HEALTHY"):
        raise RuntimeError("Project identity or health check failed")
    endpoint = f"projects/{ref}/config/auth"
    before = request(token, endpoint)
    required = callbacks(args.environment, port)
    if client:
        if before.get("mailer_otp_length") != 8:
            raise RuntimeError("Expected the existing 8-digit email OTP policy")
        # Separate these environments strictly. Stop for review if another callback
        # exists instead of silently deleting it or broadening its access.
        existing = [x.strip() for x in before.get("uri_allow_list", "").split(",") if x.strip()]
        if set(existing) - set(required):
            raise RuntimeError("Existing redirect allow list needs review before applying")
        request(token, endpoint, "PATCH", {
            "external_google_enabled": True,
            "external_google_client_id": client["client_id"],
            "external_google_secret": client["client_secret"],
            "external_google_skip_nonce_check": False,
            "site_url": f"http://127.0.0.1:{port}",
            "uri_allow_list": ",".join(required),
        })
    after = request(token, endpoint) if client else before
    allowed = set(x.strip() for x in after.get("uri_allow_list", "").split(","))
    ready = bool(after.get("external_google_enabled")
                 and CLIENT_ID.fullmatch((after.get("external_google_client_id") or ""))
                 and after.get("external_google_secret") and set(required) <= allowed
                 and not after.get("external_google_skip_nonce_check"))
    if client:
        for key in ["mailer_otp_length", "mailer_otp_exp", "mailer_autoconfirm", "password_min_length"]:
            if before.get(key) != after.get(key):
                raise RuntimeError("Unexpected unrelated authentication policy change")
        if not ready or after.get("external_google_client_id") != client["client_id"]:
            raise RuntimeError("Provider configuration verification failed")
    public_file = Path(".local/cloud-public.json")
    if public_file.exists():
        public = json.loads(public_file.read_text(encoding="utf-8-sig"))
        entry = public[args.environment]
        if entry["url"] != f"https://{ref}.supabase.co":
            raise RuntimeError("Public configuration environment mismatch")
        entry["googleAuthReady"] = ready
        public_file.write_text(json.dumps(public, indent=2), encoding="utf-8")
    print(json.dumps({"environment": args.environment, "applied": bool(client),
                      "googleEnabled": bool(after.get("external_google_enabled")),
                      "validClientId": bool(CLIENT_ID.fullmatch((after.get("external_google_client_id") or ""))),
                      "callbacksConfigured": set(required) <= allowed,
                      "googleAuthReady": ready}))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Configuration failed; no secret details are logged", file=sys.stderr)
        sys.exit(1)
