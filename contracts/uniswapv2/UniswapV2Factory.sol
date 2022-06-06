// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import './UniswapV2Pair.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

contract UniswapV2Factory is IUniswapV2Factory, Ownable {
    address public override feeTo;
    address public override migrator;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;
    IUniswapV2Pair public pairImplement;

    constructor() Ownable() {

    }

    function allPairsLength() external override view returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient
        pair= address(new UniswapV2Pair(token0, token1));
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external override onlyOwner {
        feeTo = _feeTo;
    }

    function setMigrator(address _migrator) external override onlyOwner {
        migrator = _migrator;
    }
}
