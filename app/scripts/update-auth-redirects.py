"""Update Supabase Auth Site URL and Redirect URI allow list for DEV and STAGING."""
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location('cfg', 'scripts/configure-google-auth.py')
cfg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cfg)

token = cfg.credential()

TARGETS = [
    {
        "ref": "rwfmqthrpbkizcofullh",
        "name": "DEV",
        "port": 8082,
        "scheme": "loan-development",
    },
    {
        "ref": "kircmwdkcdcozckrwfid",
        "name": "STAGING",
        "port": 8083,
        "scheme": "loan-staging",
    },
]

NEW_ORIGINS = [
    "https://loan-web-seven.vercel.app",
    "https://loan.duyhaohan.id.vn",
]

for t in TARGETS:
    ref = t["ref"]
    print(f"Updating {t['name']} ({ref})...")
    endpoint = f"projects/{ref}/config/auth"
    current = cfg.request(token, endpoint)

    # Base callbacks
    allowed = [
        f"http://127.0.0.1:{t['port']}/auth/callback",
        f"http://localhost:{t['port']}/auth/callback",
        f"{t['scheme']}://auth/callback",
        "loan://auth/callback",
    ]
    for origin in NEW_ORIGINS:
        allowed.append(f"{origin}/auth/callback")
        allowed.append(f"{origin}/**")

    uri_allow_list = ",".join(dict.fromkeys(allowed))  # preserve order & unique

    payload = {
        "site_url": "https://loan-web-seven.vercel.app",
        "uri_allow_list": uri_allow_list,
    }

    cfg.request(token, endpoint, "PATCH", payload)
    verify = cfg.request(token, endpoint)
    print(f"[OK] {t['name']} site_url updated to: {verify.get('site_url')}")
    print(f"[OK] {t['name']} uri_allow_list has {len(verify.get('uri_allow_list', '').split(','))} entries:")
    for u in verify.get('uri_allow_list', '').split(','):
        print(f"   - {u}")

print("\nSuccessfully updated Supabase Auth configuration!")
