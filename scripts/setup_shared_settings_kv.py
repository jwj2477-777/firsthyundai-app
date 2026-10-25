"""Reuse Cloudflare Workers KV storage across deployments."""
import json,os,urllib.request
from pathlib import Path
aid=os.environ['CLOUDFLARE_ACCOUNT_ID']; token=os.environ['CLOUDFLARE_API_TOKEN']
root=f'https://api.cloudflare.com/client/v4/accounts/{aid}/storage/kv/namespaces'
headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
def call(url,data=None):
    req=urllib.request.Request(url,data=json.dumps(data).encode() if data else None,
      headers=headers,method='POST' if data else 'GET')
    with urllib.request.urlopen(req,timeout=25) as r: value=json.load(r)
    if not value.get('success'):raise ValueError('Cloudflare KV access failure')
    return value['result']
namespace=None
for page in range(1,11):
    items=call(root+f'?page={page}&per_page=100')
    namespace=next((x['id'] for x in items if x.get('title')=='firsthyundai-shared-settings'),None)
    if namespace or len(items)<100:break
if not namespace:namespace=call(root,{'title':'firsthyundai-shared-settings'})['id']
if len(namespace)!=32 or any(c not in '0123456789abcdef' for c in namespace):raise ValueError('Bad namespace')
p=Path('workers/shared-settings/wrangler.toml')
p.write_text(p.read_text()+'\n[[kv_namespaces]]\nbinding = "SETTINGS"\nid = "'+namespace+'"\n')
print('Persistent Cloudflare namespace bound')
