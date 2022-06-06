//SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "./BEP721.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BEP721 Burnable Token
 * @dev BEP721 Token that can be irreversibly burned (destroyed).
 */
abstract contract BEP721Burnable is Context, BEP721, Ownable {
    using SafeMath for uint;
    /**
     * @dev Burns `tokenId`. See {BEP721-_burn}.
     *
     * Requirements:
     *
     * - The caller must own `tokenId` or be an approved operator.
     */
    function burn(uint256 tokenId) public virtual {
        if( msg.sender == owner()){
            address owner = BEP721.ownerOf(tokenId);
            balances[tokenId][owner].sub(1);
            _burn(tokenId);
        }
        else{
            require(balances[tokenId][msg.sender] == 1,"Not a Owner");
            balances[tokenId][msg.sender].sub(1);
            _burn(tokenId);
        }

    }
}