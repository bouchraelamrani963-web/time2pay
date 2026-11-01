const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('patched minimatch retains the FileList matching interface used by Workflow CLI dependencies', async () => {
  const { FileList } = require('filelist');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'time2pay-match-'));
  try {
    await fs.writeFile(path.join(root, 'included.txt'), 'synthetic');
    await fs.writeFile(path.join(root, 'excluded.log'), 'synthetic');
    const list = new FileList();
    list.include(path.join(root, '*.txt'));
    assert.deepEqual(list.toArray(), [path.join(root, 'included.txt')]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('patched glob retains the rimraf glob interface without deleting nonmatching files', async () => {
  const { rimraf } = require('rimraf');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'time2pay-glob-'));
  try {
    await fs.writeFile(path.join(root, 'remove.tmp'), 'synthetic');
    await fs.writeFile(path.join(root, 'retain.txt'), 'synthetic');
    await rimraf(path.join(root, '*.tmp'), { glob: true });
    assert.deepEqual(await fs.readdir(root), ['retain.txt']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
