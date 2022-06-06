const { toBN } = require("../scripts/utils");

module.exports = async (hre) => {
  // const network = await hre.ethers.provider.getNetwork();
  // const signers = await hre.ethers.getSigners();
  // const accounts = await hre.getNamedAccounts();
  // const deployer = signers[0].address;
  //
  // const {address: weth} = await hre.deployments.deploy("WETH", {
  //   from: deployer,
  //   log: true,
  // });
  //
  // const {address: pair} = await hre.deployments.deploy("UniswapV2Pair", {
  //   from: deployer,
  //   log: true,
  // });
  //
  // const {address: factory} = await hre.deployments.deploy("UniswapV2Factory", {
  //   from: deployer,
  //   log: true,
  //   args: [pair]
  // });
  //
  // const {address: router} = await hre.deployments.deploy("UniswapV2Router02", {
  //   from: deployer,
  //   log: true,
  //   args: [factory, weth]
  // });
};

module.exports.tags = ['Swap'];
