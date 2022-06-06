const fs = require('fs');

const mainContracts = [
  "mock/ERC20Mock.sol",

  "WETH.sol",
  "Sound.sol",
  "SoundBox.sol",
  "uniswapv2/UniswapV2Pair.sol",
  "uniswapv2/UniswapV2Factory.sol",
  "uniswapv2/UniswapV2Router02.sol",
]

const flatten = async(sourceDir) => {
  try { 
    fs.rmSync(sourceDir, {recursive: true}); 
    console.log(`clean folder ${sourceDir}`); 
  } catch (_ignore) {}
  fs.mkdirSync(sourceDir);

  let removeMultiLicenses = function(source) {
    let lines = source.split("\n");
    let isLicenseLines = lines.map((line) => line.indexOf("SPDX-License-Identifier") !== -1);
    let lastLicenseLine = -1;
    for (let i=0; i<isLicenseLines.length; i++) {
      if (isLicenseLines[i] === true) {
        lastLicenseLine = i; break;
      }
    }
    let newLines = [];
    let addedLicense = false;
    for (let i=0; i<isLicenseLines.length; i++) {
      if (isLicenseLines[i] === false) {
        newLines.push(lines[i]);
      } else {
        if (addedLicense === false) {
          newLines.push(lines[lastLicenseLine]);
          addedLicense = true;
        }
      }
    }

    return newLines.join("\n");
  }

  let removeFilePathLines = function(source) {
    let lines = source.split("\n");
    let isFilePathLines = lines.map((line) => line.startsWith("// File "));
    let isZeppelinLines = lines.map((line) => line.startsWith("// OpenZeppelin Contracts"));
    let newLines = [];
    for (let i=0; i<isFilePathLines.length; i++) {
      if (isFilePathLines[i] === false && isZeppelinLines[i] === false) {
        newLines.push(lines[i]);
      }
    }
    return newLines.join("\n");
  }

  let removeSourceFlattenWith = function(source) {
    let lines = source.split("\n");
    let isSourceFlattenWith = lines.map((line) => line.startsWith("// Sources flattened with"));
    let newLines = [];
    for (let i=0; i<isSourceFlattenWith.length; i++) {
      if (isSourceFlattenWith[i] === false) {
        newLines.push(lines[i]);
      }
    }
    return newLines.join("\n");
  }
  
  let promies = mainContracts.map(async(contractPath) => {
    let source = await run("flatten:get-flattened-sources", {files: [`contracts/${contractPath}`]});
    source = removeMultiLicenses(source);
    source = removeFilePathLines(source);
    source = removeSourceFlattenWith(source);
    source = source.trim();
    let fileName = contractPath.split("/").pop();
    fs.writeFileSync(`${sourceDir}/${fileName}`, source);
  });
  await Promise.all(promies);
  console.log(`flattened ${mainContracts.length} files from sources to ${sourceDir}`);
}

module.exports = {
  flatten
}