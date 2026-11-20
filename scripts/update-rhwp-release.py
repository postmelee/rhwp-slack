"""Build the dependency pins for the latest stable rhwp release."""
import argparse
import base64
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
from urllib.parse import quote
from urllib.request import urlopen

UPSTREAM = 'edwardkim/rhwp'
PRODUCT = 'postmelee/rhwp-slack'
SPEC = Path('studio/upstream.json')
MANIFEST = Path('studio/source-files.json')
STUDIO_FILES = {'index.html', 'package-lock.json', 'package.json', 'tsconfig.json', 'vite.config.ts',
                'public/favicon.ico', 'public/fonts', 'public/locale-init.js', 'public/theme-init.js'}
AREAS = ('rhwp-studio', 'rhwp-shared', 'assets', 'npm', 'src')
ROOT_FILES = ('LICENSE', 'THIRD_PARTY_LICENSES.md')
SHADER = 'src/renderer/square_gradient.sksl'

def gh(path):
    return json.loads(subprocess.check_output(['gh', 'api', path]))

def upstream(path):
    return gh(f'repos/{UPSTREAM}/{path}')

def fetch(url, limit):
    with urlopen(url, timeout=60) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Download exceeds expected size')
    return data

def allowed(area, name):
    if area == 'rhwp-studio':
        return name in STUDIO_FILES or name.startswith(('src/', 'types/', 'public/icons/', 'public/images/'))
    if area == 'rhwp-shared':
        return '.test.' not in name
    if area == 'assets':
        return name.startswith('fonts/')
    if area == 'src':
        return area + '/' + name == SHADER
    return (name.startswith('hwpctrl-ocx/src/') or
            name in {'hwpctrl-ocx/README.md', 'hwpctrl-ocx/package.json', 'editor/index.d.ts', 'editor/README.md', 'editor/package.json'})

def get_tree(sha, recursive=False):
    tree = upstream('git/trees/' + sha + ('?recursive=1' if recursive else ''))
    if tree['truncated']:
        raise ValueError('Incomplete upstream tree')
    return tree['tree']

def select_members(commit):
    root = {entry['path']: entry for entry in get_tree(commit)}
    result = {name: root[name] for name in ROOT_FILES}
    for area in AREAS:
        for entry in get_tree(root[area]['sha'], True):
            if entry['type'] == 'blob' and allowed(area, entry['path']):
                path = area + '/' + entry['path']
                if '..' in Path(path).parts or path.lower().endswith(('.hwp', '.hwpx')):
                    raise ValueError('Unexpected Studio input')
                result[path] = entry
    if len(result) > 3000 or sum(entry['size'] for entry in result.values()) > 130_000_000:
        raise ValueError('Review expanded Studio sources before updating')
    return result

def lock_sources(commit):
    selected = select_members(commit)
    def load(name):
        entry = selected[name]
        if entry['mode'] == '120000' and name == 'rhwp-studio/public/fonts':
            data = b'../../assets/fonts'
        elif entry['mode'] in ('100644', '100755'):
            data = fetch(f'https://raw.githubusercontent.com/{UPSTREAM}/{commit}/' + quote(name), entry['size'])
        else:
            raise ValueError('Unexpected source mode')
        blob = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if len(data) != entry['size'] or blob != entry['sha']:
            raise ValueError('Invalid upstream blob ' + name)
        return name, data, dict(mode=entry['mode'], blobId=blob, size=len(data), sha256=hashlib.sha256(data).hexdigest())

    members = {}
    buffer = io.BytesIO()
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool, tarfile.open(fileobj=buffer, mode='w', format=tarfile.GNU_FORMAT) as archive:
        for name, data, item in pool.map(load, sorted(selected)):
            members[name] = item
            entry = tarfile.TarInfo(name)
            if item['mode'] == '120000':
                entry.type, entry.linkname, entry.mode = tarfile.SYMTYPE, data.decode(), 0o777
            else:
                entry.size = len(data)
                entry.mode = int(item['mode'][-3:], 8)
            archive.addfile(entry, io.BytesIO(data) if entry.isfile() else None)
    return {'commit': commit, 'members': members}, hashlib.sha256(buffer.getbuffer()).hexdigest()

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def open_candidate(version):
    branch = 'codex/rhwp-' + version
    rows = gh(f'repos/{PRODUCT}/pulls?state=open&base=devel&head=postmelee:{branch}')
    return next((row for row in rows if row['head']['repo']['full_name'] == PRODUCT), None)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-current', action='store_true', help='recompute pins without changing files')
    args = parser.parse_args()
    spec = json.loads(SPEC.read_text())
    release = upstream('releases/latest')
    tag = release['tag_name']
    if release['draft'] or release['prerelease'] or not re.fullmatch(r'v(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){2}', tag):
        raise ValueError('Expected a stable semantic version')
    version = tag[1:]
    commit = upstream('commits/' + tag)['sha']
    if not re.fullmatch('[a-f0-9]{40}', commit):
        raise ValueError('Invalid commit')
    if version == spec['version'] and commit != spec['commit']:
        raise ValueError('Previously pinned release tag moved')
    if not args.verify_current:
        existing = open_candidate(version)
        if existing:
            # Recover a dispatch lost after PR creation. Never dispatch a manual
            # contributor branch with the release job's credentials.
            if existing['user']['login'] == 'github-actions[bot]' and 'GITHUB_OUTPUT' in os.environ:
                sha = existing['head']['sha']
                runs = gh(f'repos/{PRODUCT}/actions/workflows/ci.yml/runs?event=workflow_dispatch&head_sha={sha}')
                if not runs['workflow_runs']:
                    with open(os.environ['GITHUB_OUTPUT'], 'a') as outputs:
                        print('dispatch_branch=codex/rhwp-' + version, file=outputs)
            print('Existing candidate:', existing['html_url'])
            return
        if tuple(map(int,version.split('.'))) <= tuple(map(int,spec['version'].split('.'))):
            print('Release already pinned:', tag)
            return
    pins = {}
    for package in ('@rhwp/core','@rhwp/editor'):
        meta = json.loads(fetch('https://registry.npmjs.org/' + quote(package,safe='') + '/' + version, 2_000_000))
        url = f'https://registry.npmjs.org/{package}/-/{package.split("/")[1]}-{version}.tgz'
        if meta['name'] != package or meta['version'] != version or meta['dist']['tarball'] != url:
            raise ValueError('Registry identity mismatch')
        integrity = 'sha512-' + base64.b64encode(hashlib.sha512(fetch(url, 80_000_000)).digest()).decode()
        if integrity != meta['dist']['integrity']:
            raise ValueError('Invalid package integrity')
        pins[package] = integrity
    manifest, digest = lock_sources(commit)
    if args.verify_current:
        if version != spec['version'] or digest != spec['archiveSha256'] or manifest != json.loads(MANIFEST.read_text()):
            raise ValueError('Current Studio pins differ from the release')
    else:
        subprocess.run(['npm','install','--package-lock-only','--save-exact','--ignore-scripts','--no-audit','--no-fund',*[p+'@'+version for p in pins]],check=True)
        write_json(MANIFEST,manifest)
        write_json(SPEC,{**spec,'version':version,'commit':commit,'archiveSha256':digest})
    lock = json.loads(Path('package-lock.json').read_text())['packages']
    for package, integrity in pins.items():
        node = lock['node_modules/'+package]
        if node['version'] != version or node['integrity'] != integrity or lock['']['dependencies'][package] != version:
            raise ValueError('npm lock disagrees with the registry')
    if not args.verify_current and 'GITHUB_OUTPUT' in os.environ:
        with open(os.environ['GITHUB_OUTPUT'],'a') as outputs:
            print('version='+version,file=outputs)
    print('Verified',tag,commit,digest)

if __name__ == '__main__':
    main()
