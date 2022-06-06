const { toBN } = require("../scripts/utils");

module.exports = async (hre) => {
  const network = await hre.ethers.provider.getNetwork();
  const signers = await hre.ethers.getSigners();
  const accounts = await hre.getNamedAccounts();
  const deployer = signers[0].address;

  const {address: coin} = await hre.deployments.deploy("ERC20Mock", {
    from: deployer,
    args: ["Binance USD", "BUSD"],
    log: true,
  });
};

module.exports.tags = ['Coin'];