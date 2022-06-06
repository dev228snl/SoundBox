const { toBN } = require("../scripts/utils");

module.exports = async (hre) => {
  const network = await hre.ethers.provider.getNetwork();
  const signers = await hre.ethers.getSigners();
  const accounts = await hre.getNamedAccounts();
  const deployer = accounts.ledger ?? accounts.admin;
  // const dev = accounts.dev;

  console.log((await hre.ethers.provider.getBalance(deployer)).toString());

  const {address: coin} = await hre.deployments.deploy("SoundBox", {
    from: deployer,
    args: [
      // "0x66977BCeb072604D9CAFDd723A301b1340B77471",
      // "0xe9e7cea3dedca5984780bafc599bd69add087d56"
      (await hre.ethers.getContract("Sound")).address,
      (await hre.ethers.getContract("ERC20Mock")).address
    ],
    log: true,
  });

  // add SoundBox to TaxFee in Sound

  console.log((await hre.ethers.provider.getBalance(deployer)).toString());
};

module.exports.tags = ['SoundBox'];


module.exports.dependencies = ["Sound", "Swap", "Coin"];