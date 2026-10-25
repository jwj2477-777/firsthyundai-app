import json,urllib.request
r=urllib.request.Request('https://firsthyundai-shared-settings.jwj2477.workers.dev/health',headers={'Cache-Control':'no-cache'})
with urllib.request.urlopen(r,timeout=20) as f:data=json.load(f)
if not data.get('ok') or not data.get('storage') or not data.get('authConfigured'):
    raise SystemExit('Shared settings Worker missing KV binding or admin secret')
print('Shared settings Worker ready')
