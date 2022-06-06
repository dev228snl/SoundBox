const path = require('path');
const fs = require("fs");
const env_path = path.join(__dirname, '.', '.env');
require('dotenv').config({
  path: fs.existsSync(env_path) ? env_path : path.join(__dirname, '.', '.local.env')
});

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-deploy");
require("hardhat-deploy-ethers");

const privateKeys = [
  process.env.ADMIN_KEY,
  /* accounts below for test */
  ...(process.env.ACCOUNTS === undefined ? []:process.env.ACCOUNTS.split(",")),
].filter(a => !!a);

// default path (i.e.  `m/44'/60'/0'/0/0`
const mnemonic = process.env.MNEMONIC;

const { flatten } = require("./hardhat.tasks");
task("flatten", "", async() => flatten("flatten"));

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  mocha: {
    timeout: false
  },
  solidity: {
    compilers: [{
      version: "0.8.5",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    }],
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    admin: 0
  },
  networks: {
    hardhat: {
      saveDeployments: true,
      accounts: mnemonic !== undefined ?
        { mnemonic: mnemonic }
        : privateKeys.map((privateKey) => {
          return {privateKey: privateKey, balance: "1000000000000000000000000"}
        }),
      allowUnlimitedContractSize: true,
    },
    binancetestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: privateKeys,
      chainId: 97,
      gasPrice: 10000000000,
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
      timeout: 120000
    },
    binance: {
      url: "https://bsc-dataseed.binance.org",
      accounts: privateKeys,
      chainId: 56,
      // gasPrice: 8000000000,
      gasPrice: "auto",
      blockGasLimit: 79196578,
      allowUnlimitedContractSize: true,
      timeout: 120000
    }
  },
  paths: {
    sources: "flatten",
    tests: "tests",
    cache: "cache",
    artifacts: "artifacts",
    deploy: 'deploy',
    deployments: 'deployments',
    imports: 'imports',
  },
};
