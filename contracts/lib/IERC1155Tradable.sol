// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IERC1155Tradable is IERC1155 {
    function uri(uint256 _id) external view returns (string memory);

    function totalSupply(uint256 _id) external view returns (uint256);

    function setURI(string memory _newURI) external;

    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
    ) external;

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) external;

    function burn(
        address _from,
        uint256 _id,
        uint256 _quantity
    ) external;

    function batchBurn(
        address _from,
        uint256[] memory _ids,
        uint256[] memory _quantities
    ) external;
}
