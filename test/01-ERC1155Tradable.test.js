import { assert, expect } from 'chai';
import { ethers } from 'hardhat';
const vals = require('../lib/valuesCommon.js');

const {
  utils: { id },
  constants: { MaxUint256 },
} = ethers;

describe('ERC1155Tradable', () => {
  const NAME = 'Jungle Road Character';
  const SYMBOL = 'JGRD-C';
  const HASH_ZERO =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
  const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

  const URI = 'https://jungleroad.io';

  const INITIAL_TOKEN_ID = 1;
  const NON_EXISTENT_TOKEN_ID = 99999999;
  const MINT_AMOUNT = 100;

  const OVERFLOW_NUMBER = MaxUint256;
  const FACTORY_ROLE = id('FACTORY');
  const DEFAULT_ADMIN_ROLE = '0x00';

  // Keep track of token ids as we progress through the tests, rather than
  // hardcoding numbers that we will have to change if we add/move tests.
  // For example if test A assumes that it will create token ID 1 and test B
  // assumes that it will create token 2, changing test A later so that it
  // creates another token will break this as test B will now create token ID 3.
  // Doing this avoids this scenario.
  let tokenId = 0;
  let minted = 0;

  before(async function () {
    this.accounts = await ethers.getSigners();
    this.owner = this.accounts[0].address;
    this.factory = this.accounts[1];
    this.userA = this.accounts[2];
    this.userB = this.accounts[3];
    this.proxyForOwner = this.accounts[5].address;

    const c = await ethers.getContractFactory('JungleRoadCharacter');
    this.instance = await c.deploy();
    await this.instance.deployed();

    const approveC = await ethers.getContractFactory('ApprovedSpenderContract');
    this.approvedContract = await approveC.deploy();
    await this.approvedContract.deployed();

    await this.instance.grantRole(FACTORY_ROLE, this.factory.address);
  });

  describe('#constructor()', () => {
    it('should set the token name, symbol, and URI', async function () {
      const name = await this.instance.name();
      expect(name).to.equals(NAME);
      const symbol = await this.instance.symbol();
      expect(symbol).to.equals(SYMBOL);
    });
  });

  describe('#totalSupply()', () => {
    it('should return correct value for token supply', async function () {
      const supplyNFTValue = await this.instance.totalSupply(tokenId);
      expect(supplyNFTValue).to.equals(0);
      const balance = await this.instance.balanceOf(this.owner, tokenId);

      // Make explicitly sure everything mateches
      expect(supplyNFTValue).to.equals(balance);
    });

    it('should return zero for non-existent token', async function () {
      const balanceValue = await this.instance.balanceOf(
        this.owner,
        NON_EXISTENT_TOKEN_ID
      );
      expect(balanceValue).to.equals(0);
      const supplyAccessorValue = await this.instance.totalSupply(
        NON_EXISTENT_TOKEN_ID
      );
      expect(supplyAccessorValue).to.equals(0);
    });
  });

  describe('#mint()', () => {
    it('should allow creator to mint tokens', async function () {
      await this.instance
        .connect(this.factory)
        .mint(this.userA.address, INITIAL_TOKEN_ID, MINT_AMOUNT, HASH_ZERO);
      minted += MINT_AMOUNT;
      let supply = await this.instance.totalSupply(INITIAL_TOKEN_ID);
      expect(supply).to.equals(minted);
    });

    it('should update token totalSupply when minting', async function () {
      let supply = await this.instance.totalSupply(INITIAL_TOKEN_ID);
      expect(supply).to.equals(MINT_AMOUNT);
      await this.instance
        .connect(this.factory)
        .mint(this.userA.address, INITIAL_TOKEN_ID, MINT_AMOUNT, HASH_ZERO);
      minted += MINT_AMOUNT;
      supply = await this.instance.totalSupply(INITIAL_TOKEN_ID);
      expect(supply).to.equals(minted);
    });

    it('should not overflow token balances', async function () {
      const supply = await this.instance.totalSupply(INITIAL_TOKEN_ID);
      expect(supply).to.equals(minted);
      await expect(
        this.instance
          .connect(this.factory)
          .mint(
            this.userB.address,
            INITIAL_TOKEN_ID,
            OVERFLOW_NUMBER,
            HASH_ZERO
          )
      ).to.be.revertedWith('revert');
    });
  });

  describe('#batchMint()', () => {
    it('should correctly set totalSupply', async function () {
      await this.instance
        .connect(this.factory)
        .batchMint(
          this.userA.address,
          [INITIAL_TOKEN_ID],
          [MINT_AMOUNT],
          HASH_ZERO
        );
      minted += MINT_AMOUNT;
      const supply = await this.instance.totalSupply(INITIAL_TOKEN_ID);
      expect(supply).to.equals(minted);
    });

    it('should not overflow token balances', async function () {
      await expect(
        this.instance
          .connect(this.factory)
          .batchMint(
            this.userB.address,
            [INITIAL_TOKEN_ID],
            [OVERFLOW_NUMBER],
            HASH_ZERO
          )
      ).to.be.reverted;
    });

    it('should require that caller has permission to mint each token', async function () {
      await expect(
        this.instance
          .connect(this.userB)
          .batchMint(
            this.userA.address,
            [INITIAL_TOKEN_ID],
            [MINT_AMOUNT],
            HASH_ZERO
          )
      ).to.be.revertedWith(
        `AccessControl: account ${this.userB.address.toLowerCase()} is missing role ${FACTORY_ROLE}`
      );
    });
  });

  describe('#setURI()', () => {
    const newUri = 'https://newuri.com';
    it('should allow the owner to set the url', async function () {
      await this.instance.setURI(newUri);
      const uriTokenId = 1;
      const uri = await this.instance.tokenURI(uriTokenId);
      expect(uri).to.equals(newUri + '/' + uriTokenId);
    });

    it('should not allow non-owner to set the url', async function () {
      await expect(
        this.instance.connect(this.userA).setURI(newUri)
      ).to.be.revertedWith(
        `AccessControl: account ${this.userA.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });

    it('should allow the owner to set the url multiple times', async function () {
      await this.instance.setURI(newUri);
      await this.instance.setURI(newUri);
      await this.instance.setURI(newUri);
      const uriTokenId = 1;
      const uri = await this.instance.tokenURI(uriTokenId);
      expect(uri).to.equals(newUri + '/' + uriTokenId);

      expect(await this.instance.tokenURI(2)).to.equals(newUri + '/2');
    });
  });

  describe('#uri()', () => {
    it('should return the uri that supports the substitution method', async function () {
      await this.instance.setURI(URI);
      const uriTokenId = 1;
      const uri = await this.instance.tokenURI(uriTokenId);
      expect(uri).to.equals(URI + '/' + uriTokenId);
    });
  });

  describe('#isApprovedForAll()', () => {
    it('should approve proxy address as _operator', async function () {
      await this.instance.setApprovalForAll(this.proxyForOwner, true);
      assert.isOk(
        await this.instance.isApprovedForAll(this.owner, this.proxyForOwner)
      );
    });

    it('should not approve non-proxy address as _operator', async function () {
      assert.isNotOk(
        await this.instance.isApprovedForAll(this.owner, this.userB.address)
      );
    });

    it('should reject proxy as _operator for non-owner _owner', async function () {
      assert.isNotOk(
        await this.instance.isApprovedForAll(
          this.userA.address,
          this.proxyForOwner
        )
      );
    });

    it('should accept approved _operator for _owner', async function () {
      await this.instance
        .connect(this.userA)
        .setApprovalForAll(this.userB.address, true);
      assert.isOk(
        await this.instance.isApprovedForAll(
          this.userA.address,
          this.userB.address
        )
      );
      // Reset it here
      await this.instance
        .connect(this.userA)
        .setApprovalForAll(this.userB.address, false);
    });

    it('should not accept non-approved _operator for _owner', async function () {
      await this.instance
        .connect(this.userA)
        .setApprovalForAll(this.userB.address, false);
      assert.isNotOk(
        await this.instance.isApprovedForAll(
          this.userA.address,
          this.userB.address
        )
      );
    });
  });

  describe('Burning NFT', () => {
    it('should allow admin to burn NFTs', async function () {
      const currentBalance = await this.instance.balanceOf(
        this.userA.address,
        INITIAL_TOKEN_ID
      );

      const quantity = 10;
      await this.instance.burn(this.userA.address, INITIAL_TOKEN_ID, quantity);

      expect(
        await this.instance.balanceOf(this.userA.address, INITIAL_TOKEN_ID)
      ).is.equals(currentBalance.sub(quantity));
    });

    it('should allow factory to burn NFTs', async function () {
      const currentBalance = await this.instance.balanceOf(
        this.userA.address,
        INITIAL_TOKEN_ID
      );

      const quantity = 10;
      await this.instance
        .connect(this.factory)
        .burn(this.userA.address, INITIAL_TOKEN_ID, quantity);

      expect(
        await this.instance.balanceOf(this.userA.address, INITIAL_TOKEN_ID)
      ).is.equals(currentBalance.sub(quantity));
    });

    it('should disallow not owner to burn NFTs', async function () {
      const quantity = 10;
      await expect(
        this.instance
          .connect(this.userB)
          .burn(this.userA.address, INITIAL_TOKEN_ID, quantity)
      ).to.be.revertedWith(
        `AccessControl: account ${this.userB.address.toLowerCase()} is missing role ${FACTORY_ROLE}`
      );
    });

    it('should allow operator to batch burn NFTs', async function () {
      const currentBalance = await this.instance.balanceOf(
        this.userA.address,
        INITIAL_TOKEN_ID
      );

      const quantity = 10;
      await this.instance.batchBurn(
        this.userA.address,
        [INITIAL_TOKEN_ID],
        [quantity]
      );

      expect(
        await this.instance.balanceOf(this.userA.address, INITIAL_TOKEN_ID)
      ).is.equals(currentBalance.sub(quantity));
    });

    it('should disallow not owner to batch burn NFTs', async function () {
      const quantity = 10;
      await expect(
        this.instance
          .connect(this.userB)
          .batchBurn(this.userA.address, [INITIAL_TOKEN_ID], [quantity])
      ).to.be.revertedWith(
        `AccessControl: account ${this.userB.address.toLowerCase()} is missing role ${FACTORY_ROLE}`
      );
    });
  });
});
