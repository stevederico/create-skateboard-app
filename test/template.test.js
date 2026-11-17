import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_TEMPLATE_REF,
  DEFAULT_TEMPLATE_REPO,
  readTemplatePagesOrDefault,
  templateRef,
  templateRepo
} from '../bin/cli.js';

const DEFAULT_PAGES = [{ title: 'Dashboard', url: 'home', icon: 'layout-dashboard' }];

function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function withTemplateDir(constantsJson, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'csa-pages-'));
  try {
    if (constantsJson !== undefined) {
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'src', 'constants.json'), constantsJson);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('default template is pinned to the skateboard release tag 5.10.0', () => {
  assert.equal(DEFAULT_TEMPLATE_REF, '5.10.0');
  assert.equal(DEFAULT_TEMPLATE_REPO, 'https://github.com/stevederico/skateboard.git');
  withEnv({ SKATEBOARD_REF: undefined, SKATEBOARD_REPO: undefined }, () => {
    assert.equal(templateRef(), DEFAULT_TEMPLATE_REF);
    assert.equal(templateRepo(), DEFAULT_TEMPLATE_REPO);
  });
});

test('SKATEBOARD_REF and SKATEBOARD_REPO override the pinned template', () => {
  withEnv({ SKATEBOARD_REF: 'main', SKATEBOARD_REPO: '/tmp/local-skateboard' }, () => {
    assert.equal(templateRef(), 'main');
    assert.equal(templateRepo(), '/tmp/local-skateboard');
  });
});

test('template pages come from src/constants.json when readable', () => {
  const pages = [{ title: 'Inbox', url: 'inbox', icon: 'inbox' }];
  withTemplateDir(JSON.stringify({ pages }), (dir) => {
    assert.deepEqual(readTemplatePagesOrDefault(dir), pages);
  });
});

test('unreadable or missing template constants fall back to the default pages', () => {
  withTemplateDir('{ not json', (dir) => {
    assert.deepEqual(readTemplatePagesOrDefault(dir), DEFAULT_PAGES);
  });
  withTemplateDir(undefined, (dir) => {
    assert.deepEqual(readTemplatePagesOrDefault(dir), DEFAULT_PAGES);
  });
  withTemplateDir(JSON.stringify({ pages: 'home' }), (dir) => {
    assert.deepEqual(readTemplatePagesOrDefault(dir), DEFAULT_PAGES);
  });
});
