#!/usr/bin/env python3
"""Domain availability pre-check via NS lookup (pip install dnspython).
NXDOMAIN for a .com/.io/.ai means the name is not delegated in the TLD zone: almost always
available, but a few registered-without-nameservers or pending-delete names exist, so the
registrar (Cloudflare Registrar) is the final word. Usage: scripts/check-domains.py name1 name2 --tlds com,io,ai
"""
import sys, concurrent.futures as cf
import dns.resolver

r = dns.resolver.Resolver(); r.timeout = 4; r.lifetime = 8
def status(d):
    try: r.resolve(d, "NS"); return "taken"
    except dns.resolver.NXDOMAIN: return "free?"
    except dns.resolver.NoAnswer: return "taken"
    except dns.resolver.NoNameservers: return "taken?"
    except Exception as e: return "err"

args = [a for a in sys.argv[1:] if not a.startswith("--tlds")]
tlds = next((a.split("=")[1].split(",") for a in sys.argv[1:] if a.startswith("--tlds")), ["com"])
doms = [f"{n}.{t}" for n in args for t in tlds]
with cf.ThreadPoolExecutor(16) as ex: res = dict(zip(doms, ex.map(status, doms)))
print(f"{'name':18}" + "".join(f"{t:8}" for t in tlds))
for n in args: print(f"{n:18}" + "".join(f"{res[f'{n}.{t}']:8}" for t in tlds))
