/* data.go.kr accepts both displayed key forms; normalize before URLSearchParams
   encodes exactly once. A percent-encoded secret must never be double encoded. */
export function normalizeKmaKey(value){
 const key=String(value||'').trim();
 return /%[0-9a-f]{2}/i.test(key)?decodeURIComponent(key):key;
}
