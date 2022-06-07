//SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "./interfaces/IBEP20.sol";
import "./BEP721.sol";
import "./BEP721Enumerable.sol";
import "./BEP721URIStorage.sol";
import "./Auth.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";


contract SoundBox is
    Auth,
    BEP721,
    BEP721Enumerable,
    BEP721URIStorage {

    using SafeMath for uint256;

    string baseURI;

    IBEP20 public SOUND;
    IBEP20 public BUSD;
    address public receiver;

    // Box account, can not transfer owner
    struct Box {
        address owner;
        uint256 balance;
    }
    mapping(address => Box) public userBox;
    uint256 public soundNeed;

    enum AlbumType {PLATINUM, DIAMOND, GOLDEN}

    struct Album {
        uint256 id;
        uint albumType;
        bool forSell;
        uint256 price;
    }

    mapping(uint => uint256) public priceInBUSD;
    mapping(uint => uint256) public priceInSOUND;
    mapping(uint => uint256) public albumInStock;
    event SetPrice(uint albumType, uint256 soundAmount, uint256 busdAmount);
    event Recharge(uint256 albumId);

    mapping(uint256 => Album) public albums;
    mapping(uint => string) public albumMetadata;

    event BuyAlbum(address from, address to, uint256 albumId, uint albumType);

    uint256 public limitedAlbumPerUser = 10;
    bool public isLimitedAlbum = true;
    bool public enableMarket = false;

    address public signer;
    mapping(bytes32 => bool) public executedSignatures;
    event ExecuteSignature(bytes32 hash);

    address constant ZERO = 0x0000000000000000000000000000000000000000;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    event Deposit(address user, uint256 amount);
    event Withdraw(address user, uint256 amount);

    constructor(IBEP20 _sound, IBEP20 _busd) BEP721("Album", "ALBUM") Auth(msg.sender) {
        SOUND = _sound;
        BUSD = _busd;
        receiver = msg.sender;
        priceInBUSD[uint(AlbumType.PLATINUM)] = 100 * (10**18);
        priceInBUSD[uint(AlbumType.DIAMOND)] = 75 * (10**18);
        priceInBUSD[uint(AlbumType.GOLDEN)] = 50 * (10**18);

        priceInSOUND[uint(AlbumType.PLATINUM)] = 230000 * (10**9);
        priceInSOUND[uint(AlbumType.DIAMOND)] = 158000 * (10**9);
        priceInSOUND[uint(AlbumType.GOLDEN)] = 118000 * (10**9);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(BEP721, BEP721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
    function _burn(uint256 tokenId) internal override(BEP721, BEP721URIStorage) {
        super._burn(tokenId);
    }
    function tokenURI(uint256 tokenId) public view override(BEP721, BEP721URIStorage) returns (string memory) {
        require(_exists(tokenId));
        Album memory album = albums[tokenId];
        return albumMetadata[album.albumType];
    }
    function uri(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId));
        Album memory album = albums[tokenId];
        return albumMetadata[album.albumType];
    }
    function setMetadataURI(uint albumType, string memory _uri) external authorized {
        require(albumType < 3, "invalid type");
        albumMetadata[albumType] = _uri;
    }
    function _baseURI() internal pure override returns (string memory) {
        return "";
    }
    function supportsInterface(bytes4 interfaceId) public view override(BEP721, BEP721Enumerable) returns (bool){
        return super.supportsInterface(interfaceId);
    }

    function setReceiver(address _receiver) external authorized {
        receiver = _receiver;
    }

    function setAlbumPrice(uint albumType, uint256 soundAmount, uint256 busdAmount)  external authorized {
        require(albumType < 3, "invalid type");
        // buy album by one of BUSD or SOUND only, not either
        require(
            soundAmount > 0 || busdAmount > 0,
            "invalid price"
        );
        priceInSOUND[albumType] = soundAmount;
        priceInBUSD[albumType] = busdAmount;
        emit SetPrice(albumType, soundAmount, busdAmount);
    }
    function setLimitedAlbum(uint256 limitedPerUser, bool isLimited) external authorized {
        limitedAlbumPerUser = limitedPerUser;
        isLimitedAlbum = isLimited;
    }
    function setStock(uint albumType, uint256 stock) external authorized {
        require(albumType < 3, "invalid type");
        albumInStock[albumType] = stock;
    }

    function getBox(address user) internal returns (Box storage) {
        Box storage box = userBox[user];
        if (box.owner == ZERO) {
            box.owner = user;
            box.balance = 0;
        }
        return box;
    }
    function deposit(uint256 amount) external {
        SOUND.transferFrom(msg.sender, address(this), amount);
        Box storage box = getBox(msg.sender);
        box.balance += amount;
        soundNeed += amount;
        emit Deposit(msg.sender, amount);
    }
    function buyNew(uint albumType) public {
        require(albumType < 3,  "invalid type");
        Box storage box = getBox(msg.sender);
        require(balanceOf(msg.sender) < limitedAlbumPerUser, "can not buy more");
        require( (!isLimitedAlbum) || (isLimitedAlbum && albumInStock[albumType] > 0), "out of stock");

        if (priceInBUSD[albumType] > 0) {
            BUSD.transferFrom(msg.sender, receiver, priceInBUSD[albumType]);
        } else if (priceInSOUND[albumType] > 0) {
            require(box.balance >= priceInSOUND[albumType], "not enough balance");
            box.balance -= priceInSOUND[albumType];
        }
        uint256 albumId = totalSupply();
        _mint(msg.sender, albumId);
        albums[albumId] = Album({
            id: albumId,
            albumType: albumType,
            forSell: false,
            price: 0
        });

        if (isLimitedAlbum) {
            albumInStock[albumType] -= 1;
        }

        emit BuyAlbum(msg.sender, ZERO, albumId, albumType);
    }
    function recharge(uint256 albumId) public {
        require(ownerOf(albumId) == msg.sender, "not owner");
        Album memory album = albums[albumId];
        uint256 amount = priceInSOUND[album.albumType].div(2);
        require(amount > 0, "can not recharge");

        Box memory box = userBox[msg.sender];
        require(box.balance >= amount, "not enough balance");
        box.balance -= amount;
        emit Recharge(albumId);
    }

    function sell(uint256 albumId, bool forSell, uint256 price) external {
        require(ownerOf(albumId) == msg.sender, "not owner");
        Album storage album = albums[albumId];
        album.forSell = forSell;
        album.price = price;
    }
    function buy(uint256 albumId) public {
        require(enableMarket, "market not enable");
        Album storage album = albums[albumId];
        require(album.forSell, "not for sell");

        address oldOwner = ownerOf(album.id);

        Box storage buyer = getBox(msg.sender);
        Box storage seller = getBox(oldOwner);
        require(buyer.balance >= album.price, "not enough balance");
        buyer.balance -= album.price;
        seller.balance += album.price;

        _transfer(oldOwner, msg.sender, album.id);
        album.forSell = false;
        album.price = 0;
        emit BuyAlbum(msg.sender, oldOwner, album.id, album.albumType);
    }
    function setEnableMarket() external authorized {
        enableMarket  = true;
    }

    function setSigner(address _signer) external authorized {
        signer = _signer;
    }
    function verifySignature(address _signer, bytes memory _signature, bytes32 _hash) public view returns(bool) {
        return SignatureChecker.isValidSignatureNow(_signer, _hash, _signature);
    }
    function claim(bytes memory signature, uint256 nonce, uint256 reward) public {
        // abi encode of [uint256, address, uint256] == 84 bytes
        bytes32 hash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n84", nonce, msg.sender, reward
        ));
        require(!executedSignatures[hash], "signature was executed");
        require(verifySignature(signer, signature, hash), "signature invalid");

        Box storage box = getBox(msg.sender);
        box.balance += reward;
        soundNeed += reward;
        executedSignatures[hash] = true;
        emit ExecuteSignature(hash);
    }
    function withdraw(uint256 amount) public {
        Box storage box = getBox(msg.sender);
        require(box.balance >= amount, "amount exceeds balance");
        require(SOUND.balanceOf(address(this)) >= amount, "not enough balance");
        SOUND.transfer(msg.sender, amount);
        box.balance -= amount;
        soundNeed -= amount;
        emit Withdraw(msg.sender, amount);
    }

    function claimAndRecharge(uint256 albumId, bytes memory signature, uint256 nonce, uint256 reward) external {
        claim(signature, nonce, reward);
        recharge(albumId);
    }
    function claimAndWithdraw(uint256 amount, bytes memory signature, uint256 nonce, uint256 reward) external {
        claim(signature, nonce, reward);
        withdraw(amount);
    }
    function claimAndBuyNew(uint albumType, bytes memory signature, uint256 nonce, uint256 reward) external {
        claim(signature, nonce, reward);
        buyNew(albumType);
    }
    function claimAndBuy(uint256 albumId, bytes memory signature, uint256 nonce, uint256 reward) external {
        claim(signature, nonce, reward);
        buy(albumId);
    }

    function needSound() public view returns (uint256) {
        if (SOUND.balanceOf(address(this)) >= soundNeed) {
            return 0;
        }
        return soundNeed.sub(SOUND.balanceOf(address(this)));
    }
    function drawSound(uint256 amount) external authorized {
        SOUND.transfer(receiver, amount);
    }
}