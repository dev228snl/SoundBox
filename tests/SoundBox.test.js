const { expect } = require("chai");
const hre = require("hardhat");
const { toBN } = require("../scripts/utils");


describe("SoundBox", function () {
  async function deploy(hre) {
    const signers = await hre.ethers.getSigners();
    const admin = signers[0];
    const signer = signers[1];


    const SOUND = await hre.ethers.getContractFactory("Sound");
    const sound = await SOUND.deploy();
    await sound.deployed();

    const BUSD = await hre.ethers.getContractFactory("ERC20Mock");
    const busd = await BUSD.deploy("Binance USD", "BUSD");
    await busd.deployed();

    const BOX = await hre.ethers.getContractFactory("SoundBox");
    const box = await BOX.deploy(sound.address, busd.address);
    await box.deployed();
    await (await box.setSigner(signer.address)).wait();
    await (await sound.setTaxFree(box.address, true)).wait();

    return {signers, sound, box, busd};
  }

  function toEthSignedMessageHash (hre, messageHex) {
    const messageBuffer = Buffer.from(messageHex.substring(2), 'hex');
    const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n${messageBuffer.length}`);
    return hre.web3.utils.sha3(Buffer.concat([prefix, messageBuffer]));
  }

  async function createSignature(hre, signer, abi_types, values) {
    let encoded_message = hre.ethers.utils.solidityPack(abi_types, values);
    return await signer.signMessage(hre.ethers.utils.arrayify(encoded_message));
  }

  it("check signature", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const signer = signers[1];
    const user = signers[2];

    expect((await box.functions["signer()"]())[0]).to.equal(signer.address);

    // follow testcase in github
    // let hash = hre.web3.utils.sha3("hello");
    // let signature1 = await hre.web3.eth.sign(hash, signer.address);
    // let signature2 = await signer.signMessage(hre.ethers.utils.arrayify(hash));
    // let signature3 = await hre.web3.eth.accounts.sign(hash, "0x81b12a5302264863d48e7746472792d6a4079eefd9aca7fa1f6e3bd14084a17d")
    // console.log(signature1, signature2, signature3);

    let [nonce, user_address, amount] = [123, user.address, 100000];
    let hash = toEthSignedMessageHash(hre, hre.ethers.utils.solidityPack(
      ["uint256", "address", "uint256"],
      [123, user.address, 100000]
    ));
    let signature = await createSignature(
      hre, admin,
      ["uint256", "address", "uint256"],
      [123, user.address, 100000]
    );
    expect(await box.verifySignature(signer.address, signature, hash)).to.equal(false);
    expect(await box.verifySignature(admin.address, signature, hash)).to.equal(true);
  });

  it("set album type price", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const user = signers[1];

    await expect(box.connect(user).setAlbumPrice(1, 100000, 0)).to.be.revertedWith("!AUTHORIZED");
    await expect(box.setAlbumPrice(1, 100000, 100000)).to.be.revertedWith("invalid price");

    expect(await box.priceInSOUND(0)).to.equal(0);
    expect(await box.priceInBUSD(0)).to.equal(toBN("100").mul(toBN(10).pow(18)));
    expect(await box.priceInSOUND(1)).to.equal(0);
    expect(await box.priceInBUSD(1)).to.equal(toBN("75").mul(toBN(10).pow(18)));
    expect(await box.priceInSOUND(2)).to.equal(0);
    expect(await box.priceInBUSD(2)).to.equal(toBN("50").mul(toBN(10).pow(18)));
    expect(await box.priceInSOUND(3)).to.equal(0);
    expect(await box.priceInBUSD(3)).to.equal(0);

    await (await box.setAlbumPrice(1, 100000, 0)).wait();
    expect(await box.priceInSOUND(1)).to.equal(100000);
    expect(await box.priceInBUSD(1)).to.equal(0);

    await (await box.setAlbumPrice(2, 0, 100000)).wait();
    expect(await box.priceInSOUND(2)).to.equal(0);
    expect(await box.priceInBUSD(2)).to.equal(100000);
  });

  it("buy new album", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const user = signers[2];

    await (await box.setLimitedAlbum(10, false)).wait();

    const totalBUSD = toBN("10000").mul(toBN(10).pow(18));

    await (await busd.connect(user).approve(box.address, totalBUSD)).wait();

    await expect(box.connect(user).buyNew(1)).to.be.revertedWith("ERC20: transfer amount exceeds balance");

    await (await busd.mint(user.address, totalBUSD)).wait();

    expect(await busd.balanceOf(admin.address)).to.equal(0);
    await (await box.connect(user).buyNew(1)).wait();
    expect(await box.balanceOf(user.address)).to.equal(1);
    expect(await busd.balanceOf(user.address)).to.equal(totalBUSD.sub(toBN(75).mul(toBN(10).pow(18))));
    expect(await busd.balanceOf(admin.address)).to.equal(toBN(75).mul(toBN(10).pow(18)));

    await (await sound.transfer(user.address, "1000000000000")).wait();
    const oldBUSD = await busd.balanceOf(user.address);
    const oldSound = await sound.balanceOf(user.address);

    await (await box.setAlbumPrice(1, 100000, 0)).wait();
    await expect(box.connect(user).buyNew(1)).to.be.revertedWith("not have enough fund");

    await (await sound.connect(user).approve(box.address, 1000000000000)).wait();
    await (await box.connect(user).deposit(1000000000000)).wait();
    await (await box.setAlbumPrice(1, 100000, 0)).wait();
    await (await box.connect(user).buyNew(1)).wait();
    expect(await busd.balanceOf(user.address)).to.equal(oldBUSD);
    expect((await box.userBox(user.address))["balance"]).to.equal(oldSound.sub(100000));

    for (let i=0; i<8; i++){
      await (await box.connect(user).buyNew(1)).wait();
    }
    await expect(box.connect(user).buyNew(1)).to.be.revertedWith("can not buy more");

    await (await box.setLimitedAlbum(12, true)).wait();
    await (await box.setStock(1, 1)).wait();
    await (await box.connect(user).buyNew(1)).wait();
    await expect(box.connect(user).buyNew(1)).to.be.revertedWith("out of stock");
  });

  it("sell album", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const signer = signers[1];
    const user = signers[2];
    const buyer = signers[3];

    await (await box.setLimitedAlbum(12, true)).wait();
    await (await box.setStock(1, 1)).wait();

    const totalBUSD = toBN("10000").mul(toBN(10).pow(18));
    await (await busd.mint(user.address, totalBUSD)).wait();
    await (await busd.connect(user).approve(box.address, totalBUSD)).wait();
    await (await sound.transfer(buyer.address, 1000000000000)).wait();
    await (await sound.connect(buyer).approve(box.address, 1000000000000)).wait();
    await (await box.connect(buyer).deposit(1000000000000)).wait();

    await (await box.connect(user).buyNew(1)).wait();
    await expect(box.sellAlbum(0, true, 10000)).to.be.revertedWith("not owner");

    await expect(box.buyAlbum(0)).to.be.revertedWith("market not enable");
    await (await box.setEnableMarket()).wait();
    await expect(box.buyAlbum(0)).to.be.revertedWith("not for sell");
    await (await box.connect(user).sellAlbum(0, true, 10000)).wait();

    expect(await box.ownerOf(0)).to.equal(user.address);
    await (await box.connect(buyer).buyAlbum(0)).wait();
    expect(await box.ownerOf(0)).to.equal(buyer.address);
    expect((await box.userBox(buyer.address))["balance"]).to.equal(1000000000000-10000);
    expect((await box.userBox(user.address))["balance"]).to.equal(10000);
  });

  it("claim reward to box", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const signer = signers[1];
    const user = signers[2];

    let [nonce, user_address, amount] = [123, user.address, 100000];
    let signature = await createSignature(
      hre, admin,
      ["uint256", "address", "uint256"],
      [nonce, user_address, amount]
    );
    await expect(box.connect(user).claim(signature, nonce, amount))
      .to.be.revertedWith("signature invalid");

    signature = await createSignature(
      hre, signer,
      ["uint256", "address", "uint256"],
      [nonce, user_address, amount]
    );
    expect((await box.userBox(user.address))["balance"]).to.equal(0);
    await (await box.connect(user).claim(signature, nonce, amount)).wait();
    expect((await box.userBox(user.address))["balance"]).to.equal(amount);

    await expect(box.connect(user).claim(signature, nonce, amount))
      .to.be.revertedWith("signature was executed");
  });

  it("withdraw from box", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const signer = signers[1];
    const user = signers[2];

    let [nonce, user_address, amount] = [123, user.address, 100000];
    const signature = await createSignature(
      hre, signer,
      ["uint256", "address", "uint256"],
      [nonce, user_address, amount]
    );
    await (await box.connect(user).claim(signature, nonce, amount)).wait();

    await expect(box.connect(user).withdraw(amount)).to.be.revertedWith("not enough fund");
    await (await sound.transfer(box.address, "10000000000")).wait();
    await expect(box.connect(user).withdraw(amount+1)).to.be.revertedWith("amount exceeds balance");
    expect(await sound.balanceOf(user.address)).to.equal(0);
    await (await box.connect(user).withdraw(amount)).wait();
    expect(await sound.balanceOf(user.address)).to.equal(amount);
  });

  it("withdraw & claim", async function(){
    const {signers, sound, box, busd} = await deploy(hre);
    const admin = signers[0];
    const signer = signers[1];
    const user = signers[2];

    await (await sound.setTaxFree(user.address, true)).wait();

    let [nonce, user_address, amount] = [123, user.address, 100000];
    const signature = await createSignature(
      hre, signer,
      ["uint256", "address", "uint256"],
      [nonce, user_address, amount]
    );

    await (await sound.transfer(box.address, amount+100)).wait();

    await (await sound.transfer(user.address, amount)).wait();
    await (await sound.connect(user).approve(box.address, amount)).wait();
    await (await box.connect(user).deposit(amount)).wait();

    expect(await sound.balanceOf(user.address)).to.equal(0);
    await (await box.connect(user).withDrawAndClaim(amount+100, signature, nonce, amount)).wait();

    expect(await sound.balanceOf(user.address)).to.equal(amount+100);
    expect((await box.userBox(user.address))["balance"]).to.equal(amount-100);

    await (await box.connect(user).withdraw(amount-100)).wait();
    expect(await sound.balanceOf(user.address)).to.equal(amount*2);
    expect((await box.userBox(user.address))["balance"]).to.equal(0);
    expect(await sound.balanceOf(box.address)).to.equal(100);
  });

});
