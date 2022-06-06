//SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IBEP20.sol";
import "./Auth.sol";

contract Sound is IBEP20, Auth {
    using SafeMath for uint256;

    address DEAD = 0x000000000000000000000000000000000000dEaD;
    address ZERO = 0x0000000000000000000000000000000000000000;

    string constant _name = "Sound";
    string constant _symbol = "SOUND";
    uint8 constant _decimals = 9;
    uint256 _totalSupply = 2 * (10**9) * (10 ** _decimals);
    mapping (address => uint256) _balances;
    mapping (address => mapping (address => uint256)) _allowances;

    uint256 public buyTax = 30;
    uint256 public sellTax = 40;
    uint256 public constant taxDenominator = 1000;
    uint256 public constant maxTax = 100;

    address public taxReceiver;

    mapping (address => bool) isTaxFree;

    uint256 public taxThreshold = _totalSupply / 5000;

    address public pair;

    constructor () Auth(msg.sender) {
        isTaxFree[msg.sender] = true;
        taxReceiver = msg.sender;
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    receive() external payable { }

    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function decimals() external pure override returns (uint8) { return _decimals; }
    function symbol() external pure override returns (string memory) { return _symbol; }
    function name() external pure override returns (string memory) { return _name; }
    function getOwner() external view override returns (address) { return owner; }
    function balanceOf(address account) public view override returns (uint256) { return _balances[account]; }
    function allowance(address holder, address spender) external view override returns (uint256) { return _allowances[holder][spender]; }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function approveMax(address spender) external returns (bool) {
        return approve(spender, type(uint256).max);
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        return _transferFrom(msg.sender, recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        if(_allowances[sender][msg.sender] != type(uint256).max) {
            _allowances[sender][msg.sender] = _allowances[sender][msg.sender].sub(amount, "Insufficient Allowance");
        }

        return _transferFrom(sender, recipient, amount);
    }

    function _transferFrom(address sender, address recipient, uint256 amount) internal returns (bool) {
        if(_balances[address(this)] >= taxThreshold) {
            transferTax();
        }

        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");

        uint256 amountReceived = (!isTaxFree[sender]) ? takeTax(sender, recipient, amount) : amount;
        _balances[recipient] = _balances[recipient].add(amountReceived);

        emit Transfer(sender, recipient, amountReceived);
        return true;
    }

    function _basicTransfer(address sender, address recipient, uint256 amount) internal returns (bool) {
        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
        return true;
    }

    function setTaxFree(address adr, bool isFree) external authorized {
        isTaxFree[adr] = isFree;
    }

    function setTax(uint256 _sellTax, uint256 _buyTax) external authorized {
        require(_sellTax <= maxTax && _buyTax <= maxTax, "tax too high");
        sellTax = _sellTax;
        buyTax = _buyTax;
    }

    function takeTax(address sender, address receiver, uint256 amount) internal returns (uint256) {
        uint256 tax = amount.mul(receiver == pair ? sellTax : buyTax).div(taxDenominator);

        _balances[address(this)] = _balances[address(this)].add(tax);
        emit Transfer(sender, address(this), tax);

        return amount.sub(tax);
    }

    function transferTax() internal {
        uint256 amount = _balances[address(this)];
        _basicTransfer(address(this), taxReceiver, amount);
    }

    function transferBNB() external authorized {
        (bool success,) = address(this).call{value:address(this).balance}(new bytes(0));
        require(success, 'BNB transfer failed');
    }

    function setReceivers(address _taxReceiver) external authorized {
        taxReceiver = _taxReceiver;
    }

    function setPair(address _pair) external authorized {
        pair = _pair;
    }

    function setTaxThreshold(uint256 _amount) external authorized {
        taxThreshold = _amount;
    }

    function manualTransferTax() external authorized {
        transferTax();
    }
    
    function getCirculatingSupply() public view returns (uint256) {
        return _totalSupply.sub(balanceOf(DEAD)).sub(balanceOf(ZERO));
    }
}