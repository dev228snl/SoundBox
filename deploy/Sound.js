const { toBN } = require("../scripts/utils");

module.exports = async (hre) => {
  const network = await hre.ethers.provider.getNetwork();
  const signers = await hre.ethers.getSigners();
  const accounts = await hre.getNamedAccounts();
  const deployer = accounts.admin;

  console.log((await hre.ethers.provider.getBalance(deployer)).toString());
  const {address: sound} = await hre.deployments.deploy("Sound", {
    from: deployer,
    log: true,
  });
  // create pair
  // set pair
  // set uni presale fee tax

  console.log((await hre.ethers.provider.getBalance(deployer)).toString());
};

module.exports.tags = ['Sound'];


module.exports.dependencies = ["Swap", "Coin"];