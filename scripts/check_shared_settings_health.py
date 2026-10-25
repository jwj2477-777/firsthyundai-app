"""Health verification with explicit worker-access diagnostics (never credentials)."""
import json
import urllib.request
import urllib.error
import time

url='https://firsthyundai-shared-settings.jwj2477.workers.dev/health'
for attempt in range(1,4):
    try:
        req=urllib.request.Request(url,headers={
            'Cache-Control':'no-store',
            'Accept':'application/json',
            'User-Agent':'Mozilla/5.0 (compatible; FirstHyundaiServiceHealth/1.0)'
        })
        with urllib.request.urlopen(req,timeout=20) as response:
            body=json.load(response)
        if not body.get('ok') or not body.get('storage') or not body.get('authConfigured') or not body.get('boardAuthConfigured'):
            raise SystemExit('Shared settings worker KV or private admin verifier missing')
        print('Public shared settings Worker is healthy')
        break
    except urllib.error.HTTPError as error:
        print('Worker public access HTTP',error.code,'headers:',dict(error.headers),
              'body snippet:',error.read(350).decode('utf-8','replace'))
        if attempt==3:raise
    except Exception as error:
        print('Worker health network/JSON error:',type(error).__name__)
        if attempt==3:raise
    time.sleep(4)
