import { expect } from 'chai';
import { ethers } from 'hardhat';

const {
  utils: { parseEther, formatEther, id },
} = ethers;
const vals = require('../lib/valuesCommon.js');

const FACTORY_ROLE = id('FACTORY');

async function deploy(contractName, args, lib) {
  const Contract = await ethers.getContractFactory(contractName, lib);
  if (args?.length) {
    const contract = await Contract.deploy(...args);
    await contract.deployed();
    return contract;
  }
  const contract = await Contract.deploy();
  await contract.deployed();
  return contract;
}

async function mint(contract, owner, amount) {
  const _amount = parseEther(amount);
  const tx = await contract.mint(owner.address, _amount.toString());
  await tx.wait();
}

async function approve(contract, owner, approveTo, amount) {
  const _amount = parseEther(amount);
  const tx = await contract

    .connect(owner)
    .approve(approveTo.address, _amount.toString());
  await tx.wait();
}

async function approveAll(owner, busd, contracts) {
  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    await busd
      .connect(owner)
      .approve(contract.address, ethers.constants.MaxInt256);
  }
}

describe('# JungleRoadFactory 2', async function () {
  // Deploy contracts
  beforeEach(async function () {
    [this.owner] = await ethers.getSigners();
    // owner > factory
    // creators > owner(multisig)
    this.JungleRoadCharacter = await deploy('JungleRoadCharacter');

    // lib only
    // deployer > owner(multisig)
    // useLibBy LOOT BOX
    this.VRF = await deploy('VRF');

    // owner > factory
    // state > lootBox
    this.JungleRoadLootBox = await deploy('JungleRoadLootBox');

    this.BUSD = await deploy('MockBUSD', ['Binance USD', 'BUSD']);

    // owner > owner(multisig)
    this.JungleRoadFactory = await deploy('JungleRoadFactory', [
      this.JungleRoadCharacter.address,
      this.VRF.address,
      this.BUSD.address,
    ]);
  });

  // initial setup
  beforeEach(async function () {
    await mint(this.BUSD, this.owner, '100000000000');
    expect(await this.BUSD.balanceOf(this.owner.address)).equal(
      parseEther('200000000000')
    );

    await approveAll(this.owner, this.BUSD, [this.JungleRoadFactory]);
    expect(
      await this.BUSD.allowance(
        this.owner.address,
        this.JungleRoadFactory.address
      )
    ).gt('0');
  });

  describe('## Pause & Unpause', async function () {
    beforeEach(async function () {
      [, this.userA] = await ethers.getSigners();
    });

    it('should revert `purchase` when paused', async function () {
      const quantity = 1;
      await expect(
        this.JungleRoadFactory.purchase(this.userA.address, quantity)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should revert `mintCharacter` when paused', async function () {
      const optionId = 5;
      await expect(
        this.JungleRoadFactory.mintCharacter(optionId, this.userA.address)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should be allow to call `withdraw` and get money even paused', async function () {
      expect(await this.JungleRoadFactory.paused()).to.be.true;
      await expect(this.JungleRoadFactory.withdraw()).to.be.not.reverted;
    });

    it('should be allow to call `transferOwnership` when paused', async function () {
      expect(await this.JungleRoadFactory.paused()).to.be.true;
      await expect(this.JungleRoadFactory.transferOwnership(this.userA.address))
        .to.be.not.reverted;
      expect(await this.JungleRoadFactory.owner()).to.equal(this.userA.address);
    });

    it('should be call unpause when paused', async function () {
      expect(await this.JungleRoadFactory.paused()).to.be.true;
      await expect(this.JungleRoadFactory.unpause()).to.be.not.reverted;
    });
  });

  describe('## access control', async function () {
    beforeEach(async function () {
      await this.JungleRoadCharacter.grantRole(
        FACTORY_ROLE,
        this.JungleRoadFactory.address
      );
      await this.JungleRoadLootBox.grantRole(
        FACTORY_ROLE,
        this.JungleRoadFactory.address
      );
    });

    describe('### JungleRoadCharacter', async function () {
      it('should has factory on FATORY role', async function () {
        expect(
          await this.JungleRoadCharacter.hasRole(
            FACTORY_ROLE,
            this.JungleRoadFactory.address
          )
        ).to.be.true;
      });
    });

    describe('### JungleRoadLootBox', async function () {
      it('should has factory on FATORY role', async function () {
        expect(
          await this.JungleRoadLootBox.hasRole(
            FACTORY_ROLE,
            this.JungleRoadFactory.address
          )
        ).to.be.true;
      });
    });
  });

  describe('## Purchase', async function () {
    it('should be revertWith  purchase > MAX total supply', async function () {});
  });

  describe('## URI', async function () {
    beforeEach(async function () {
      [this.owner, this.userA] = await ethers.getSigners();
    });

    describe('### JungleRoadCharacter', async function () {
      it('should allow admin to set uri', async function () {
        const uri = 'https://www.jungleroad.com';
        await this.JungleRoadCharacter.setURI(uri);
        for (let i = 0; i < vals.NUM_JUNGLE_ROADS_OPTIONS; i++) {
          expect(await this.JungleRoadCharacter.tokenURI(i)).to.equal(
            `${uri}/${i}`
          );
        }
      });

      it('should disallow non-admin to set uri', async function () {
        const uri = 'https://www.jungleroad.com';
        await expect(
          this.JungleRoadCharacter.connect(this.userA).setURI(uri)
        ).to.be.revertedWith(
          `AccessControl: account ${this.userA.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
        );
      });
    });

    describe('### JungleRoadLootBox', async function () {
      it('should allow admin to set uri', async function () {
        const uri = 'https://www.jungleroad.com';
        const tokenId = 0;
        await this.JungleRoadLootBox.setURI(uri);
        expect(await this.JungleRoadLootBox.tokenURI(tokenId)).to.equal(
          `${uri}/${tokenId}`
        );
      });

      it('should disallow non-admin to set uri', async function () {
        const uri = 'https://www.jungleroad.com';
        await expect(
          this.JungleRoadLootBox.connect(this.userA).setURI(uri)
        ).to.be.revertedWith(
          `AccessControl: account ${this.userA.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
        );
      });
    });
  });

  describe('## Seed', async function () {
    beforeEach(async function () {
      [this.owner, this.userA] = await ethers.getSigners();
    });

    it('should disallow everyone to set seed directly to VRF contract', async function () {
      expect(this.VRF).to.not.have.property('setSeed');
    });

    it('should allow admin to set seed on LootBox contract', async function () {
      const seed = '0x1234567890';
      await expect(this.JungleRoadLootBox.setSeed(seed)).to.be.not.reverted;
    });

    it('should allow non-admin to set seed on LootBox contract', async function () {
      const seed = '0x1234567890';
      await expect(
        this.JungleRoadLootBox.connect(this.userA).setSeed(seed)
      ).to.be.revertedWith(
        `AccessControl: account ${this.userA.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    });
  });
});
