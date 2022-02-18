import { assert, expect } from 'chai';
import { ethers } from 'hardhat';

const {
  utils: { parseEther, formatEther, id },
} = ethers;

/* libraries used */
const { setupLootBox } = require('../lib/setupJungleRoad.js');
const vals = require('../lib/valuesCommon.js');
const { findRarity, findAnimal } = require('./utils/rarity.js');

/* Tests */
describe('JungleRoadFactory', async function () {
  const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
  const HASH_ZERO =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  let character;
  let factory;
  let lootBox;
  let busd;

  let minted = 0;
  let opened = 0;
  const lootBoxMaxSupply = 4400;
  const FACTORY_ROLE = id('FACTORY');

  before(async () => {
    this.accounts = await ethers.getSigners();
    this.owner = this.accounts[0].address;
    this.userA = this.accounts[1];
    this.userB = this.accounts[2];
    this.userC = this.accounts[3];
    this.userD = this.accounts[4];

    const Character = await ethers.getContractFactory('JungleRoadCharacter');
    character = await Character.deploy();
    await character.deployed();

    const VRF = await ethers.getContractFactory('VRF');
    const randomness = await VRF.deploy();
    await randomness.deployed();

    const JungleRoadLootBox = await ethers.getContractFactory(
      'JungleRoadLootBox'
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

    await busd.transfer(this.userA.address, parseEther('10000000'));
    await busd.transfer(this.userB.address, parseEther('10000000'));
    await busd.transfer(this.userC.address, parseEther('10000000'));
    await busd.transfer(this.userD.address, parseEther('10000000'));

    await busd.approve(factory.address, parseEther('10000000'));
    await busd
      .connect(this.userA)
      .approve(factory.address, parseEther('10000000'));
    await busd
      .connect(this.userB)
      .approve(factory.address, parseEther('10000000'));
    await busd
      .connect(this.userC)
      .approve(factory.address, parseEther('10000000'));
    await busd
      .connect(this.userD)
      .approve(factory.address, parseEther('10000000'));
  });

  // This also tests the proxyRegistryAddress and lootBoxAddress accessors.
  describe('#constructor()', () => {
    it('should return nft and lootbox addresses correctly', async () => {
      assert.equal(await factory.jungleRoad(), character.address);
      assert.equal(await factory.lootBox(), lootBox.address);
    });
  });

  describe('Pause', () => {
    it('should disallow to purchase box when contract is global paused', async () => {
      const quantity = 1;
      await expect(
        factory.connect(this.userA).purchase(this.userA.address, quantity)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should allow user to purchase box when contract is global unpaused', async () => {
      const quantity = 2;
      await factory.unpause();
      await factory.connect(this.userA).purchase(this.userA.address, quantity);
      minted += quantity;
    });

    it('should disallow to unbox when contract is global paused', async () => {
      await factory.pause();
      await expect(
        lootBox.connect(this.userA).unbox(vals.LOOTBOX_OPTION_ID, this.owner)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should allow user to unbox when contract is global unpaused', async () => {
      await factory.unpause();
      await lootBox
        .connect(this.userA)
        .unbox(vals.LOOTBOX_OPTION_ID, this.owner);
      opened++;
    });

    it('should allow user to purchase when purchase is unpaused', async () => {
      const quantity = 1;
      await factory.purchase(this.userA.address, quantity);
      minted += quantity;
    });

    it('should disallow user to purchase when purchase is paused', async () => {
      await factory.pausePurchase();
      const quantity = 1;
      await expect(
        factory.purchase(this.userA.address, quantity)
      ).to.be.revertedWith('Purchase is paused');

      // reset
      await factory.unpausePurchase();
    });

    it('should allow user to unbox when unbox is unpaused', async () => {
      await lootBox
        .connect(this.userA)
        .unbox(vals.LOOTBOX_OPTION_ID, this.userA.address);
      opened++;
    });

    it('should disallow user to unbox when unbox is paused', async () => {
      await factory.pauseUnbox();
      await expect(
        lootBox
          .connect(this.userA)
          .unbox(vals.LOOTBOX_OPTION_ID, this.userA.address)
      ).to.be.revertedWith('Unbox is paused');

      // reset
      await factory.unpauseUnbox();
    });

    it('should allow admin to global pause', async () => {
      await factory.pause();
      expect(await factory.paused()).to.be.true;

      //reset
      await factory.unpause();
    });

    it('should disallow non-admin to global pause', async () => {
      await expect(factory.connect(this.userA).pause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should allow admin to purchase pause', async () => {
      await expect(factory.pausePurchase()).to.be.not.reverted;

      //reset
      await factory.unpausePurchase();
    });

    it('should disallow non-admin to purchase pause', async () => {
      await expect(factory.connect(this.userA).pause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should allow admin to unbox pause', async () => {
      await expect(factory.pauseUnbox()).to.be.not.reverted;

      //reset
      await factory.unpauseUnbox();
    });

    it('should disallow non-admin to unbox pause', async () => {
      await expect(factory.connect(this.userA).pauseUnbox()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  //NOTE: We test this early relative to its place in the source code as we
  //      mint tokens that we rely on the existence of in later tests here.
  describe('#Purchase LootBox', () => {
    it('should allow non-owner or non-operator to mint box', async () => {
      const quantity = 1;
      await expect(
        factory.connect(this.userA).purchase(this.userA.address, quantity)
      )
        .to.emit(lootBox, 'TransferSingle')
        .withArgs(
          factory.address,
          ADDRESS_ZERO,
          this.userA.address,
          vals.LOOTBOX_OPTION_ID,
          quantity
        );
      minted += quantity;
    });

    it('should allow owner to mint', async () => {
      const quantity = 1;
      const balanceBox = await lootBox.balanceOf(
        this.owner,
        vals.LOOTBOX_OPTION_ID
      );
      await factory.purchase(this.owner, quantity);
      expect(
        await lootBox.balanceOf(this.owner, vals.LOOTBOX_OPTION_ID)
      ).to.equal(balanceBox.add(quantity));
      minted += quantity;
    });
  });

  describe('Functional', () => {
    it('should allow owner to unbox', async () => {
      const quantity = 1;
      await factory.purchase(this.owner, quantity);
      minted += quantity;

      const balanceBox = await lootBox.balanceOf(
        this.owner,
        vals.LOOTBOX_OPTION_ID
      );

      await lootBox.unbox(vals.LOOTBOX_OPTION_ID, this.owner);
      opened++;
      expect(
        await lootBox.balanceOf(this.owner, vals.LOOTBOX_OPTION_ID)
      ).to.equal(balanceBox.sub(quantity));
    });

    it('should allow owner to withdraw', async () => {
      const balance = await busd.balanceOf(this.owner);
      const contractBalance = await busd.balanceOf(factory.address);
      await factory.withdraw();
      expect(await busd.balanceOf(this.owner)).to.equal(
        balance.add(contractBalance)
      );
      expect(await busd.balanceOf(factory.address)).to.equals(0);
    });

    it('should disallow non-owner to withdraw', async () => {
      await expect(factory.connect(this.userA).withdraw()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('Unbox with probability', async () => {
    it('unbox 1000 boxes with proper probability of received nfts', async () => {
      const quantity = 100;
      const processPerTime = 10;
      const balanceBox = await lootBox.balanceOf(
        this.userA.address,
        vals.LOOTBOX_OPTION_ID
      );

      for (let i = 0; i < quantity / processPerTime; i++) {
        await factory
          .connect(this.userA)
          .purchase(this.userA.address, processPerTime);
        minted += processPerTime;
      }

      expect(
        await lootBox.balanceOf(this.userA.address, vals.LOOTBOX_OPTION_ID)
      ).to.eq(balanceBox.add(quantity));

      const tokenIdWithAmounts = new Array(vals.NUM_JUNGLE_ROADS_OPTIONS).fill(
        0
      );
      let tx, id;
      let total = 0;
      let animals = {
        monkey: 0,
        bear: 0,
        fox: 0,
        cat: 0,
        bird: 0,
      };

      let rarities = {
        common: 0,
        uncommon: 0,
        rare: 0,
        legendary: 0,
        immortal: 0,
      };

      for (let i = 0; i < quantity; i++) {
        tx = await lootBox
          .connect(this.userA)
          .unbox(vals.LOOTBOX_OPTION_ID, this.userA.address);
        opened++;
        tx = await tx.wait();
        // the first event is burning lootbox
        // the second events are minting character
        // the 2 last txs is useless
        for (let j = 1; j < tx.events.length - 2; j++) {
          id = tx.events[j].args['id'].toNumber();
          rarities[findRarity(id)]++;
          animals[findAnimal(id)]++;
          total++;
          tokenIdWithAmounts[id] = tokenIdWithAmounts[id] + 1;
        }
      }
    });
  });

  describe('Quantity info', () => {
    it('should returns correct info', async () => {
      const info = await factory.quantityInfo();
      expect(info._minted).to.be.equals(minted);
      expect(info._opened).to.be.equals(opened);
      expect(info._available).to.be.equals(lootBoxMaxSupply - minted);
      expect(info._unopened).to.be.equals(minted - opened);
    });
  });

  describe('Purchase limit', () => {
    it('should allow user to purchase lootbox within limit', async () => {
      expect(
        await lootBox.balanceOf(this.userC.address, vals.LOOTBOX_OPTION_ID)
      ).to.be.eq(0);

      const quantity = 1;
      await factory.connect(this.userC).purchase(this.userC.address, quantity);
      minted += quantity;

      await factory.connect(this.userC).purchase(this.userC.address, quantity);
      minted += quantity;

      await factory.connect(this.userC).purchase(this.userC.address, quantity);
      minted += quantity;

      expect(
        await lootBox.balanceOf(this.userC.address, vals.LOOTBOX_OPTION_ID)
      ).to.be.eq(3);
    });

    it('should allow user to purchase if global max supply does not exceeds', async () => {
      const quantity = 10;
      await factory.connect(this.userD).purchase(this.userD.address, quantity);
      minted += quantity;
      expect(await factory.minted()).is.equals(minted);
      expect(
        await lootBox.balanceOf(this.userD.address, vals.LOOTBOX_OPTION_ID)
      ).is.equals(quantity);
    });

    it('should allow mint lootbox equals max total supply', async () => {
      const remainingBox = lootBoxMaxSupply - minted;
      const processPerTime = 10;
      for (let i = 0; i < remainingBox / processPerTime; i++) {
        if (i * processPerTime <= remainingBox - processPerTime) {
          await factory
            .connect(this.userD)
            .purchase(this.userD.address, processPerTime);
          minted += processPerTime;
        } else {
          const last = remainingBox % 10;
          await factory.connect(this.userD).purchase(this.userD.address, last);
          minted += last;
        }
      }

      expect(await factory.minted()).is.equals(lootBoxMaxSupply);
    });

    it('should disallow user to purchase if global max supply exceeds', async () => {
      const quantity = 1;
      expect(quantity + minted).is.greaterThan(lootBoxMaxSupply);
      await expect(
        factory.connect(this.userD).purchase(this.userD.address, quantity)
      ).to.be.revertedWith('Loot box supply is exceeded');
    });
  });

  describe('Ownership', () => {
    it('should allow to transfer ownership of lootbox to a new owner', async () => {
      await lootBox.grantRole(FACTORY_ROLE, this.userA.address);
      expect(await lootBox.hasRole(FACTORY_ROLE, this.userA.address)).to.be
        .true;
      await lootBox.revokeRole(FACTORY_ROLE, factory.address);
      expect(await lootBox.hasRole(FACTORY_ROLE, factory.address)).to.be.false;

      // reset
      await lootBox.grantRole(FACTORY_ROLE, factory.address);
      await lootBox.revokeRole(FACTORY_ROLE, this.userA.address);
    });

    it('should allow to transfer ownership of main nft to a new owner', async () => {
      await character.grantRole(FACTORY_ROLE, this.userA.address);
      expect(await character.hasRole(FACTORY_ROLE, this.userA.address)).to.be
        .true;
      await character.revokeRole(FACTORY_ROLE, factory.address);
      expect(await character.hasRole(FACTORY_ROLE, factory.address)).to.be
        .false;

      // reset
      await character.grantRole(FACTORY_ROLE, factory.address);
      await character.revokeRole(FACTORY_ROLE, this.userA.address);
    });
  });

  describe('Future phases', () => {
    it('allow new factory to mint NFT of users', async () => {
      const tokenId = 0;
      const quantity = 1;
      const newFactory = this.userB;
      const currentBalance = await character.balanceOf(
        this.userA.address,
        tokenId
      );

      await character.grantRole(FACTORY_ROLE, newFactory.address);
      expect(await character.hasRole(FACTORY_ROLE, newFactory.address)).to.be
        .true;
      await character.revokeRole(FACTORY_ROLE, factory.address);
      expect(await character.hasRole(FACTORY_ROLE, factory.address)).to.be
        .false;

      await character
        .connect(newFactory)
        .mint(this.userA.address, tokenId, quantity, HASH_ZERO);

      expect(await character.balanceOf(this.userA.address, tokenId)).to.equals(
        currentBalance.add(quantity)
      );
    });

    it('allow new factory to burn NFT of users when user deposit their NFT', async () => {
      const tokenId = 0;
      const quantity = 1;
      const newFactory = this.userB;
      const currentBalance = await character.balanceOf(
        this.userA.address,
        tokenId
      );

      await character.grantRole(FACTORY_ROLE, newFactory.address);
      expect(await character.hasRole(FACTORY_ROLE, newFactory.address)).to.be
        .true;
      await character.revokeRole(FACTORY_ROLE, factory.address);
      expect(await character.hasRole(FACTORY_ROLE, factory.address)).to.be
        .false;

      await character
        .connect(newFactory)
        .burn(this.userA.address, tokenId, quantity);
      expect(await character.balanceOf(this.userA.address, tokenId)).is.equals(
        currentBalance.sub(quantity)
      );
    });
  });
});
