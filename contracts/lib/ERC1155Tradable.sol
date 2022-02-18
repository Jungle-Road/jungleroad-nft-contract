// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ERC1155Tradable
 * ERC1155Tradable - ERC1155 contract that whitelists an operator address, has create and mint functionality, and supports useful standards from OpenZeppelin,
  like _exists(), name(), symbol(), and totalSupply()
 */

contract ERC1155Tradable is ERC1155, AccessControl {
    using Strings for string;
    using SafeMath for uint256;
    using Strings for uint256;

    bytes32 internal constant FACTORY_ROLE = keccak256("FACTORY");
    mapping(uint256 => uint256) public tokenSupply;
    // Contract name
    string public name;
    // Contract symbol
    string public symbol;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _uri
    ) ERC1155(_uri) {
        name = _name;
        symbol = _symbol;
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(FACTORY_ROLE, _msgSender());
    }

    function tokenURI(uint256 _id) public view returns (string memory) {
        return string(abi.encodePacked(uri(_id), "/", _id.toString()));
    }

    /**
     * @dev Returns the total quantity for a token ID
     * @param _id uint256 ID of the token to query
     * @return amount of token in existence
     */
    function totalSupply(uint256 _id) public view returns (uint256) {
        return tokenSupply[_id];
    }

    /**
     * @dev Sets a new URI for all token types, by relying on the token type ID
     * substitution mechanism
     * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
     * @param _newURI New URI for all tokens
     */
    function setURI(string memory _newURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(_newURI);
    }

    /**
     * @dev Mints some amount of tokens to an address
     * @param _to          Address of the future owner of the token
     * @param _id          Token ID to mint
     * @param _quantity    Amount of tokens to mint
     * @param _data        Data to pass if receiver is contract
     */
    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
    ) public virtual onlyRole(FACTORY_ROLE) {
        _mint(_to, _id, _quantity, _data);
        tokenSupply[_id] = tokenSupply[_id].add(_quantity);
    }

    /**
     * @dev Mint tokens for each id in _ids
     * @param _to          The address to mint tokens to
     * @param _ids         Array of ids to mint
     * @param _quantities  Array of amounts of tokens to mint per id
     * @param _data        Data to pass if receiver is contract
     */
    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public onlyRole(FACTORY_ROLE) {
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
            uint256 quantity = _quantities[i];
            tokenSupply[_id] = tokenSupply[_id].add(quantity);
        }
        _mintBatch(_to, _ids, _quantities, _data);
    }

    /**
     * @dev Burn some amount of tokens to an address
     * @param _from        Address of the owner of the token
     * @param _id          Token ID to mint
     * @param _quantity    Amount of tokens to mint
     */
    function burn(
        address _from,
        uint256 _id,
        uint256 _quantity
    ) public onlyRole(FACTORY_ROLE) {
        _burn(_from, _id, _quantity);
    }

    /**
     * @dev Burn tokens for each id in _ids
     * @param _from        The address to burn tokens from
     * @param _ids         Array of ids to burn
     * @param _quantities  Array of amounts of tokens to burn per id
     */
    function batchBurn(
        address _from,
        uint256[] memory _ids,
        uint256[] memory _quantities
    ) public onlyRole(FACTORY_ROLE) {
        _burnBatch(_from, _ids, _quantities);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
