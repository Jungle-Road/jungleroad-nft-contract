import { expect } from 'chai';
import { ethers } from 'hardhat';

/* libraries used */
const { setupLootBox } = require('../lib/setupJungleRoad.js');
const vals = require('../lib/valuesCommon.js');

const {
  utils: { id },
} = ethers;

/* Tests */
describe('JungleRoadLootBox', async function () {
  const HASH_ZERO =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
  const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

  const FACTORY_ROLE = id('FACTORY');

  let lootBox;
  let factory;
  let character;
  let busd;

  before(async function () {
    this.accounts = await ethers.getSigners();
    this.owner = this.accounts[0].address;
    this.userA = this.accounts[1];
    this.userB = this.accounts[2];
    this.proxyForOwner = this.accounts[8];

    const Character = await ethers.getContractFactory('JungleRoadCharacter');
    character = await Character.deploy();
    await character.deployed();

    const VRF = await ethers.getContractFactory('VRF');
    const randomness = await VRF.deploy();
    await randomness.deployed();

    const JungleRoadLootBox = await ethers.getContractFactory(
      'JungleRoadLootBox'
      // {
      //   libraries: {
      //     VRF: randomness.address,
      //   },
      // }
    );
    lootBox = await JungleRoadLootBox.deploy();
    await lootBox.deployed();

    const MockBUSD = await ethers.getContractFactory('MockBUSD');
    busd = await MockBUSD.deploy('Binance USD', 'BUSD');
    await busd.deployed();

    const JungleRoadFactory = await ethers.getContractFactory(
      'JungleRoadFactory'
    );
    factory = await JungleRoadFactory.deploy(
      character.address,
      lootBox.address,
      busd.address
    );
    await factory.deployed();

    await lootBox.grantRole(FACTORY_ROLE, factory.address);
    await character.grantRole(FACTORY_ROLE, factory.address);
    await setupLootBox(lootBox, factory);
    await factory.unpause();
  });

  // Calls _mint()
  describe('#mint()', () => {
    it('should work for owner()', async function () {
      const option = vals.LOOTBOX_OPTION_ID;
      const amount = 1;
      await expect(lootBox.mint(this.userB.address, option, amount, HASH_ZERO))
        .to.emit(lootBox, 'TransferSingle')
        .withArgs(this.owner, ADDRESS_ZERO, this.userB.address, option, amount);
    });

    it('should not be callable by non-owner() and non-factory', async function () {
      const amount = 1;
      await expect(
        lootBox
          .connect(this.userB)
          .mint(this.userB.address, vals.LOOTBOX_OPTION_ID, amount, HASH_ZERO)
      ).to.be.revertedWith(
        `AccessControl: account ${this.userB.address.toLowerCase()} is missing role ${FACTORY_ROLE}`
      );
    });

    it('should not work for invalid option', async function () {
      const amount = 1;
      await expect(
        lootBox.mint(
          this.userB.address,
          vals.NO_SUCH_ITEM_OPTION,
          amount,
          HASH_ZERO
        )
      ).to.be.revertedWith('Lootbox: Invalid Option');
    });
  });

  describe('#unbox()', () => {
    it('should unbox correctly', async function () {
      const option = vals.LOOTBOX_OPTION_ID;
      const amount = 1;
      await expect(lootBox.mint(this.userB.address, option, amount, HASH_ZERO))
        .to.emit(lootBox, 'TransferSingle')
        .withArgs(this.owner, ADDRESS_ZERO, this.userB.address, option, amount);

      // check only event[0] (burn lootbox)
      await expect(
        lootBox
          .connect(this.userB)
          .unbox(vals.LOOTBOX_OPTION_ID, this.userB.address)
      )
        .to.emit(lootBox, 'TransferSingle')
        .withArgs(
          this.userB.address,
          this.userB.address,
          ADDRESS_ZERO,
          option,
          1
        );
    });
  });
});
