//SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./BEP721.sol";

/**
 * @dev BEP721 token with storage based token URI management.
 */
abstract contract BEP721URIStorage is BEP721 {
    using Strings for uint256;
      struct Metadata {
        string name;
        string ipfsimage;
        string ipfsmetadata;
    }

    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;
        mapping(uint256 => Metadata) token_id;

    /**
     * @dev See {IBEP721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory ipfsmetadata)
    {
        require(
            _exists(tokenId),
            "BEP721URIStorage: URI query for nonexistent token"
        );

        // string memory _tokenURI = _tokenURIs[tokenId];

        // string memory base = _baseURI();
        require(_exists(tokenId), "token not minted");
          Metadata memory date = token_id[tokenId];
        ipfsmetadata= date.ipfsmetadata;
        // string memory ipfsmetadata = getmetadata(tokenId);

             return ipfsmetadata;
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _setTokenURI(uint256 tokenId, string memory _tokenURI)
        internal
        virtual
    {
        require(
            _exists(tokenId),
            "BEP721URIStorage: URI set of nonexistent token"
        );
        _tokenURIs[tokenId] = _tokenURI;
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);

        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
        }
    }
}