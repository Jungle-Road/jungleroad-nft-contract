import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('JungleRoadToken', () => {
  beforeEach(async function () {
    const [multisig] = await ethers.getSigners();
    const c = await ethers.getContractFactory('JungleRoadToken');
    this.jgrd = await c.deploy(multisig.address);
    await this.jgrd.deployed();
  });

  it('should create with correct symbol and name', async function () {
    const name = await this.jgrd.name();
    const symbol = await this.jgrd.symbol();
    expect(name).to.be.equal('Jungle Road Token');
    expect(symbol).to.be.equal('JGRD');
  });

  it('should mint 1000M to multisig', async function () {
    const [multisig] = await ethers.getSigners();
    const balance = await this.jgrd.balanceOf(multisig.address);

    const amount = (1000 * 10 ** 6).toString();
    expect(balance.toString()).to.be.equal(ethers.utils.parseEther(amount));
  });

  it('should be reverted if multisig is zero', async function () {
    const c = await ethers.getContractFactory('JungleRoadToken');
    await expect(c.deploy(ethers.constants.AddressZero)).revertedWith(
      'multiSigWallet cannot be the zero address'
    );
  });

  it('should be reverted if token paused', async function () {
    const [multisig, receiver] = await ethers.getSigners();
    await this.jgrd.connect(multisig).pause();

    await expect(
      this.jgrd.connect(multisig).transfer(receiver.address, '10')
    ).revertedWith('paused');
  });

  it('should be reverted if no multisig call pause/unpause ', async function () {
    const [, hacker] = await ethers.getSigners();

    await expect(this.jgrd.connect(hacker).pause()).revertedWith(
      'Why do you do that'
    );

    await expect(this.jgrd.connect(hacker).unpause()).revertedWith(
      'Why do you do that'
    );
  });
});
