// build.js
const esbuild = require('esbuild');
const obfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const entries = [
  'src/assets/js/main.js',
  'src/assets/js/hearing-test.js'
];

// temp dir for esbuild output
const tmpDir = path.join(__dirname, 'tmp_build');
// backup dir
const backupDir = path.join(__dirname, 'backups', new Date().toISOString().replace(/[:.-]/g, '_'));

async function run() {
  // 1) ensure tmp and backup dirs
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // 2) backup original files
  console.log('Creating backups of original files in:', backupDir);
  for (const entry of entries) {
    if (!fs.existsSync(entry)) {
      console.error(`ERROR: entry not found: ${entry}`);
      process.exit(1);
    }
    const base = path.basename(entry);
    fs.copyFileSync(entry, path.join(backupDir, base));
  }

  // 3) bundle + minify with esbuild (one outdir, keep filename = [name])
  console.log('Bundling and minifying with esbuild...');
  await esbuild.build({
    entryPoints: entries,
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: tmpDir,
    entryNames: '[name]',
    platform: 'browser',
    target: ['es2017']
  });

  // 4) obfuscate each built file and overwrite original source file
  console.log('Obfuscating and overwriting original files...');
  for (const entry of entries) {
    const name = path.basename(entry); // e.g. main.js
    const builtPath = path.join(tmpDir, name);
    if (!fs.existsSync(builtPath)) {
      console.error('ERROR: built file not found:', builtPath);
      process.exit(1);
    }
    const builtCode = fs.readFileSync(builtPath, 'utf8');

    const obfResult = obfuscator.obfuscate(builtCode, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      renameGlobals: false,
      // możesz dopasować opcje powyżej jeśli trzeba
    });

    const obfCode = obfResult.getObfuscatedCode();

    // overwrite original file in src/assets/js
    fs.writeFileSync(entry, obfCode, 'utf8');
    console.log('Overwrote:', entry);
  }

  // 5) cleanup tmp dir (opcjonalne)
  // Uncomment to remove tmp_build after success:
  // fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('\nDone. Originals backed up to:', backupDir);
  console.log('Obfuscated files are in their original locations (overwritten).');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

