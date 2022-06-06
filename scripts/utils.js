function toBN(str) {
  const hre = require("hardhat");
  return hre.ethers.BigNumber.from(str.toString());
}


module.exports = {
  toBN
}