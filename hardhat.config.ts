import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-solhint';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'dotenv/config';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import { removeConsoleLog } from 'hardhat-preprocessor';
import 'hardhat-spdx-license-identifier';
import 'solidity-coverage';

const accounts = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : [];

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    bscTest: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      saveDeployments: true,
      tags: ['bscTest'],
      accounts,
    },
    bsc: {
      url: 'https://bsc-dataseed.binance.org/',
      saveDeployments: true,
      tags: ['bsc'],
      accounts,
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 180e3,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  spdxLicenseIdentifier: {
    overwrite: true,
    runOnCompile: true,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: process.env.API_KEY,
  },
  preprocess: {
    eachLine: removeConsoleLog(
      (hre) =>
        hre.network.name !== 'hardhat' && hre.network.name !== 'localhost'
    ),
  },
};
