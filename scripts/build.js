const fs = require('fs');
const path = require('path');

function buildExtension() {
  console.log('Building extension package with cross-platform support...');
  const buildDir = path.resolve(__dirname, '../build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }
  // Simulated build steps: copy files, minify, etc.
}

buildExtension();