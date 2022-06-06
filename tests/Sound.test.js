const { expect } = require("chai");
const hre = require("hardhat");
const { toBN } = require("../scripts/utils");

describe("Sound", function () {
  // deploy swap
  // deploy SZI
  // add liquidity
  // swap
  // check fee
  async function deploy(hre) {
    const signers = await hre.ethers.getSigners();

    // setup
    const WBNB = await hre.ethers.getContractFactory("WETH");
    const wbnb = await WBNB.deploy();
    await wbnb.deployed();

    const Factory = await hre.ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy();
    await factory.deployed();
    const Router = await hre.ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factory.address, wbnb.address);

    // deploy
    const SOUND = await hre.ethers.getContractFactory("Sound");
    const sound = await SOUND.deploy();
    await sound.deployed();
    await (await factory.createPair(wbnb.address, sound.address)).wait();
    const pairAddress = await factory.getPair(wbnb.address, sound.address);
    expect(pairAddress).to.not.equal(hre.ethers.constants.AddressZero);
    await(await sound.setPair(pairAddress)).wait();
    return {signers, wbnb, factory, router, sound};
  }

  it("setTax", async function() {
    const {signers, sound} = await deploy(hre);
    const admin = signers[0];
    await (await sound.setTax(100, 100)).wait();
    await expect(sound.setTax(101, 101)).to.be.revertedWith("tax too high");
  });

  it("manualTransferTax", async function() {
    const {signers, sound} = await deploy(hre);
    const admin = signers[0];
    const marketing = signers[1];
    const team = signers[2];
    const charity = signers[3];

    await (await sound.setReceivers(charity.address)).wait();

    const totalSupply = await sound.totalSupply();
    let initAmount = totalSupply.div(10);
    await (await sound.transfer(team.address, initAmount)).wait();

    expect(await sound.balanceOf(sound.address)).to.equal(0);
    await (await sound.connect(team).transfer(marketing.address, initAmount.div(10))).wait();
    expect(await sound.balanceOf(sound.address)).to.gt(0);
    expect(await sound.balanceOf(sound.address)).to.equal(initAmount.div(10).mul(3).div(100));

    await expect(sound.connect(charity).manualTransferTax()).to.be.revertedWith("!AUTHORIZED");
    await (await sound.authorize(charity.address)).wait();
    await (await sound.connect(charity).manualTransferTax()).wait();
    expect(await sound.balanceOf(sound.address)).to.equal(0);
    expect(await sound.balanceOf(charity.address)).to.equal(initAmount.div(10).mul(3).div(100));
  });

  it("author method", async function() {
    const {signers: [admin, team], wbnb, router, sound} = await deploy(hre);
    await expect(sound.connect(team).manualTransferTax()).to.be.revertedWith("!AUTHORIZED");
    await (await sound.authorize(team.address)).wait();
    await (await sound.connect(team).manualTransferTax()).wait();

    await (await sound.unauthorize(team.address)).wait();
    await expect(sound.connect(team).manualTransferTax()).to.be.revertedWith("!AUTHORIZED");
  });

  it("check tax", async function () {
    const {signers, wbnb, router, sound} = await deploy(hre);

    const admin = signers[0];
    const marketing = signers[1];
    const lps = [signers[2],signers[3],signers[4]];
    const users = [signers[5],signers[6],signers[7],signers[8],signers[9]];

    const totalSupply = await sound.totalSupply();
    const decimals = await sound.decimals();
    expect(await sound.balanceOf(admin.address)).to.equal(totalSupply);
    await (await sound.setReceivers(marketing.address)).wait();

    let initAmount = totalSupply.div(lps.length).div(10);
    for (let i=0; i<lps.length; i++) {
      await (await sound.setTaxFree(lps[i].address, true)).wait();

      await (await sound.transfer(lps[i].address, initAmount)).wait();
      expect(await sound.balanceOf(lps[i].address)).to.equal(initAmount);
      await (await sound.connect(lps[i]).approve(
        router.address, hre.ethers.constants.MaxUint256
      )).wait();

      const soundInput = toBN(500000).mul(toBN(10).pow(decimals));
      const bnbInput = toBN(1).mul(toBN(10).pow(18));
      expect(await sound.balanceOf(lps[i].address)).to.gt(soundInput);
      expect(await hre.ethers.provider.getBalance(lps[i].address)).to.gt(bnbInput);
      await (await router.connect(lps[i]).addLiquidityETH(
        sound.address,
        soundInput,
        0, 0,
        lps[i].address,
        Math.floor(new Date().getTime()/1000)+3600,
        {value: bnbInput}
      )).wait();
    }

    // swap - buy
    for (let i=0; i<users.length; i++) {
      await (await sound.connect(users[i]).approve(router.address, hre.ethers.constants.MaxUint256)).wait();
    }
    let swapAmount;
    const threshold = totalSupply.div(5000);
    const oldBalances = [];
    oldBalances.push(await sound.balanceOf(marketing.address));
    for (let k=0; k<40; k++) {
      let oldSOUNDAmount = await sound.balanceOf(sound.address);
      for (let i=0; i<users.length; i++) {
        console.log("k", k, "i", i);
        // await hre.ethers.provider.send("evm_mine");
        let bnbAmount = toBN(25).mul(toBN(10).pow(17));
        const oldSOUNDBalance = await sound.balanceOf(users[i].address);
        await (await router.connect(users[i]).swapExactETHForTokensSupportingFeeOnTransferTokens(
          0,
          [wbnb.address, sound.address],
          users[i].address,
          Math.floor(new Date().getTime()/1000)+3600,
          {value: bnbAmount}
        )).wait();
        const newSOUNDBalance = await sound.balanceOf(users[i].address);
        swapAmount = newSOUNDBalance.sub(oldSOUNDBalance);

        let check = false;

        if (oldSOUNDAmount.gt(await sound.balanceOf(sound.address))) {
          console.log("break");
          // break;
          check = true;
        }

        // await hre.ethers.provider.send("evm_mine");
        await (await router.connect(users[i]).swapExactTokensForETHSupportingFeeOnTransferTokens(
          swapAmount, 0,
          [sound.address, wbnb.address],
          users[i].address,
          Math.floor(new Date().getTime()/1000)+3600,
        )).wait();
        if (check) {

          const diff = [];
          // console.log(
          //   oldBalances[0].toString(),
          //   (await hre.ethers.provider.getBalance(team.address)).toString()
          // );
          diff.push((await sound.balanceOf(marketing.address)).sub(oldBalances[0]));
          console.log(
            "diff", diff.map(d=>d.toString())
          );
          return;
        }
      }
    }
  });
});