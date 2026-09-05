#!/usr/bin/env python3
"""Check static pages without installing dependencies or using the network."""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGES = ('index.html', '404.html', 'portfolio/index.html', 'archive-2021.html')

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = []
        self.refs = []
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('src', 'href'):
            if attrs.get(key):
                self.refs.append(attrs[key])


def check(skip_legacy=False):
    errors = []
    documents = {}
    for name in PAGES:
        path = ROOT / name
        if not path.is_file():
            errors.append(f'Missing page: {name}')
            continue
        text = path.read_text(encoding='utf-8')
        doc = documents[name] = Document(text)
        if len(doc.ids) != len(set(doc.ids)):
            errors.append(f'Duplicate ids: {name}')
        if not any(tag == 'html' and attrs.get('lang') for tag, attrs in doc.tags):
            errors.append(f'Missing page language: {name}')
        if '<title>' not in text or 'name="viewport"' not in text:
            errors.append(f'Missing title or viewport: {name}')
        for tag, attrs in doc.tags:
            if tag == 'img' and 'alt' not in attrs:
                errors.append(f'Image missing alt: {name}')
        for ref in doc.refs:
            url = urlsplit(ref)
            if url.scheme or url.netloc:
                continue
            if not url.path:
                if url.fragment and unquote(url.fragment) not in doc.ids:
                    errors.append(f'Missing anchor: {name} -> {ref}')
                continue
            target = (path.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(ROOT):
                errors.append(f'Path outside site: {name} -> {ref}')
            elif not target.exists() and not (skip_legacy and name == 'archive-2021.html'):
                errors.append(f'Missing local resource: {name} -> {ref}')
            elif target.is_dir() and not (target / 'index.html').is_file():
                errors.append(f'Missing directory index: {name} -> {ref}')
    home = (ROOT / 'index.html').read_text(encoding='utf-8')
    try:
        data = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', home, re.S)[1])
        assert data['name'] == 'Jatin Dehmiwal'
        assert data['url'] == 'https://legedith.github.io/'
    except (TypeError, ValueError, KeyError, AssertionError):
        errors.append('Invalid Person structured data')
    doc = documents.get('index.html')
    if doc:
        projects = [a for tag, a in doc.tags if a.get('data-project')]
        if len(projects) != 3:
            errors.append('Expected three selected projects')
        if any(a.get('src', '').startswith(('http:', 'https:', '//')) for t, a in doc.tags if t == 'script'):
            errors.append('Unexpected third-party script')
    for name in ('kinematics.js', 'renderer.js', 'research.js'):
        file = ROOT / 'assets' / name
        if not file.is_file():
            errors.append(f'Missing module: {name}')
            continue
        for imported in re.findall(r"from ['\"]([^'\"]+)['\"]", file.read_text()):
            if not imported.startswith('./') or not (file.parent / imported).is_file():
                errors.append(f'Missing or non-local module: {name} -> {imported}')
    if not (ROOT / 'METHODS.md').is_file():
        errors.append('Missing method note')
    if not (ROOT / '.nojekyll').is_file():
        errors.append('Missing .nojekyll')
    for error in errors:
        print('FAIL:', error)
    if errors:
        raise SystemExit(1)
    print(f'PASS: {len(PAGES)} pages, local links, anchors, metadata and project structure.')
    if skip_legacy:
        print('Legacy asset existence skipped: those files remain in the original repository.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-legacy', action='store_true', help='For a source-only bundle without original 2021 assets')
    check(parser.parse_args().skip_legacy)
